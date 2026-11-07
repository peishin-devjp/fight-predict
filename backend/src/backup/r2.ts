import { createReadStream } from "node:fs";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "./config";
import type { LocalBackupCandidate } from "./sqliteBackup";

const BACKUP_FORMAT_VERSION = "1";

export type R2Client = Pick<S3Client, "send">;

export type VerifiedR2Backup = {
  key: string;
  size: number;
  sha256: string;
};

export function createR2Client(config: BackupConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.r2Region,
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  };

  return new S3Client(clientConfig);
}

function formatUtcTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatUtcDatePath(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");

  return `${year}/${month}/${day}`;
}

export function buildBackupObjectKey(
  prefix: string,
  createdAt: Date,
): string {
  return `${prefix}/${formatUtcDatePath(createdAt)}/fight-predict-${formatUtcTimestamp(
    createdAt,
  )}.sqlite`;
}

export async function verifyUploadedBackup(
  client: R2Client,
  config: BackupConfig,
  key: string,
  candidate: LocalBackupCandidate,
): Promise<VerifiedR2Backup> {
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
    }),
  );

  if (head.ContentLength !== candidate.size) {
    throw new Error(
      `R2 HEAD size mismatch for backup object ${key}.`,
    );
  }

  const remoteSha256 = head.Metadata?.sha256;

  if (remoteSha256 !== candidate.sha256) {
    throw new Error(
      `R2 HEAD SHA-256 metadata mismatch for backup object ${key}.`,
    );
  }

  const remoteDatabaseSize = head.Metadata?.["database-size"];

  if (remoteDatabaseSize !== candidate.size.toString()) {
    throw new Error(
      `R2 HEAD database-size metadata mismatch for backup object ${key}.`,
    );
  }

  if (head.Metadata?.["backup-format-version"] !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `R2 HEAD backup format metadata mismatch for backup object ${key}.`,
    );
  }

  return {
    key,
    size: candidate.size,
    sha256: candidate.sha256,
  };
}

export async function uploadAndVerifyBackup(
  client: R2Client,
  config: BackupConfig,
  candidate: LocalBackupCandidate,
): Promise<VerifiedR2Backup> {
  const key = buildBackupObjectKey(config.r2Prefix, candidate.createdAt);

  await client.send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: createReadStream(candidate.filePath),
      ContentLength: candidate.size,
      IfNoneMatch: "*",
      Metadata: {
        "backup-format-version": BACKUP_FORMAT_VERSION,
        "created-at": candidate.createdAt.toISOString(),
        sha256: candidate.sha256,
        "source-environment": "production",
        "database-size": candidate.size.toString(),
      },
    }),
  );

  return verifyUploadedBackup(client, config, key, candidate);
}

export async function hasVerifiedBackupForUtcDate(
  client: R2Client,
  config: BackupConfig,
  date: Date,
): Promise<boolean> {
  const dailyPrefix = `${config.r2Prefix}/${formatUtcDatePath(date)}/`;

  const listed = await client.send(
    new ListObjectsV2Command({
      Bucket: config.r2Bucket,
      Prefix: dailyPrefix,
    }),
  );

  const objects = listed.Contents ?? [];

  for (const object of objects) {
    if (!object.Key || typeof object.Size !== "number" || object.Size <= 0) {
      continue;
    }

    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: config.r2Bucket,
          Key: object.Key,
        }),
      );

      const sha256 = head.Metadata?.sha256;
      const databaseSize = head.Metadata?.["database-size"];

      if (
        head.ContentLength === object.Size &&
        typeof sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(sha256) &&
        databaseSize === object.Size.toString() &&
        head.Metadata?.["backup-format-version"] === BACKUP_FORMAT_VERSION &&
        head.Metadata?.["source-environment"] === "production"
      ) {
        return true;
      }
    } catch {
      // An invalid or partially uploaded object must not count as success.
    }
  }

  return false;
}