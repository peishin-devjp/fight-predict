import { tmpdir } from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getBackupConfig } from "./config";
import {
  createR2Client,
  type R2Client,
} from "./r2";
import {
  downloadBackupForValidation,
  validateDownloadedBackup,
} from "./restore";

type BackupObject = {
  key: string;
  lastModified?: Date | undefined;
};

export async function listBackupObjects(  client: R2Client,
  bucket: string,
  prefix: string,
): Promise<BackupObject[]> {
  const backups: BackupObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (
        object.Key &&
        object.Key.endsWith(".sqlite") &&
        typeof object.Size === "number" &&
        object.Size > 0
      ) {
        backups.push({
          key: object.Key,
          lastModified: object.LastModified,
        });
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return backups.sort((a, b) => {
    const aTime = a.lastModified?.getTime() ?? 0;
    const bTime = b.lastModified?.getTime() ?? 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return b.key.localeCompare(a.key);
  });
}

export async function runRestoreVerification(): Promise<void> {
  const configResult = getBackupConfig();

  if (!configResult.enabled) {
    throw new Error(configResult.reason);
  }

  const config = configResult.config;
  const client = createR2Client(config);

  console.log("Restore verification mode: DRY-RUN");
  console.log("Production database will not be modified.");

  const backups = await listBackupObjects(
    client,
    config.r2Bucket,
    config.r2Prefix,
  );

  if (backups.length === 0) {
    throw new Error("No backup objects were found in R2.");
  }

  const selected = backups[0];

  if (!selected) {
    throw new Error("Unable to select an R2 backup object.");
  }

  const head = await client.send(
    new HeadObjectCommand({
      Bucket: config.r2Bucket,
      Key: selected.key,
    }),
  );

  const createdAt = head.Metadata?.["created-at"];

  console.log(`Selected backup: ${selected.key}`);

  if (createdAt) {
    console.log(`Created at: ${createdAt}`);
  }

  const temporaryPath = path.join(
    tmpdir(),
    `fight-predict-restore-check-${Date.now()}.sqlite`,
  );

  try {
    const downloaded = await downloadBackupForValidation(
      client,
      config,
      selected.key,
      temporaryPath,
    );

    const migrationsDirectory = path.resolve(
      process.cwd(),
      "prisma/migrations",
    );

    const validated = await validateDownloadedBackup(
      downloaded.filePath,
      downloaded.sha256,
      downloaded.size,
      migrationsDirectory,
    );

    console.log("Restore verification PASS.");
    console.log(`Downloaded size: ${validated.size}`);
    console.log(`SHA-256: ${validated.sha256}`);
    console.log(
      `Applied migrations: ${validated.migrations.length}`,
    );
    console.log("Production database was not modified.");
  } finally {
    await rm(temporaryPath, {
      force: true,
    });
  }
}
