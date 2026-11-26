import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getBackupConfig } from "./config";
import { classifyRestoreError } from "./restoreDiagnostics";
import {
  createR2Client,
  type R2Client,
} from "./r2";
import {
  downloadBackupForValidation,
  validateDownloadedBackup,
} from "./restore";

export function parseRestoreArgs(args: string[]): {
  objectKey?: string;
} {
  if (args.length === 0) {
    return {};
  }

  if (
    args.length !== 2 ||
    args[0] !== "--key" ||
    !args[1]?.trim()
  ) {
    throw new Error(
      "Usage: restoreCommand.ts [--key <R2-object-key>]",
    );
  }

  const objectKey = args[1];

  if (
    objectKey.trim() !== objectKey ||
    !objectKey.endsWith(".sqlite") ||
    objectKey.includes("\\") ||
    objectKey.split("/").some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error("Invalid R2 backup object key.");
  }

  return { objectKey };
}

type BackupObject = {
  key: string;
  lastModified?: Date | undefined;
};

export async function listBackupObjects(
  client: R2Client,
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

export async function selectBackupObject(
  client: R2Client,
  bucket: string,
  prefix: string,
  objectKey?: string,
): Promise<BackupObject> {
  if (objectKey !== undefined) {
    if (
      !objectKey.startsWith(`${prefix}/`) ||
      !objectKey.endsWith(".sqlite")
    ) {
      throw new Error(
        "Specified backup key is outside the configured prefix.",
      );
    }

    // Explicit selection must never fall back to another object.
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
    } catch (error: unknown) {
      throw classifyRestoreError("R2_HEAD", error, "HEAD_1");
    }

    return { key: objectKey };
  }

  // Preserve the existing latest-backup selection.
  const backups = await listBackupObjects(
    client,
    bucket,
    prefix,
  );

  if (backups.length === 0) {
    throw new Error("No backup objects were found in R2.");
  }

  const latest = backups[0];

  if (!latest) {
    throw new Error("Unable to select an R2 backup object.");
  }

  return latest;
}

export async function withRestoreTemporaryDirectory<T>(
  operation: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "fight-predict-restore-check-"),
  );

  try {
    return await operation(directory);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
}

export async function runRestoreVerification(
  args: string[] = [],
  injectedClient?: R2Client,
): Promise<void> {
  const { objectKey } = parseRestoreArgs(args);

  const configResult = getBackupConfig();

  if (!configResult.enabled) {
    throw new Error(configResult.reason);
  }

  const config = configResult.config;
  const client = injectedClient ?? createR2Client(config, { maxAttempts: 1 });

  console.log("Restore verification mode: DRY-RUN");
  console.log("Production database will not be modified.");

  const selected = await selectBackupObject(
    client,
    config.r2Bucket,
    config.r2Prefix,
    objectKey,
  );

  let head;
  try {
    head = await client.send(
      new HeadObjectCommand({
        Bucket: config.r2Bucket,
        Key: selected.key,
      }),
    );
  } catch (error: unknown) {
    throw classifyRestoreError("R2_HEAD", error, "HEAD_2");
  }

  const createdAt = head.Metadata?.["created-at"];

  console.log(`Selected backup: ${selected.key}`);

  if (createdAt) {
    console.log(`Created at: ${createdAt}`);
  }

  await withRestoreTemporaryDirectory(async (temporaryDirectory) => {
    const temporaryPath = path.join(
      temporaryDirectory,
      "downloaded-backup.sqlite",
    );

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
  });
}
