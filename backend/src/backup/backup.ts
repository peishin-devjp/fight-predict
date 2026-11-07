import path from "node:path";
import { tmpdir } from "node:os";
import type { BackupConfig } from "./config";
import {
  createLocalBackupCandidate,
  removeLocalBackupCandidate,
} from "./sqliteBackup";
import {
  buildBackupObjectKey,
  createR2Client,
  verifyUploadedBackup,
  type R2Client,
  type VerifiedR2Backup,
} from "./r2";
import {
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import {
  notifyBackupFailure,
  notifyBackupSuccess,
} from "./healthchecks";

const MAX_UPLOAD_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

export type BackupResult = VerifiedR2Backup & {
  createdAt: Date;
};

type BackupDependencies = {
  r2Client?: R2Client;
  sleep?: (milliseconds: number) => Promise<void>;
};

function isRetryableR2Error(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate = error as {
    name?: string;
    $metadata?: {
      httpStatusCode?: number;
    };
  };

  const status = candidate.$metadata?.httpStatusCode;

  if (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  ) {
    return true;
  }

  return [
    "TimeoutError",
    "RequestTimeout",
    "RequestTimeoutException",
    "Throttling",
    "ThrottlingException",
    "SlowDown",
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
  ].includes(candidate.name ?? "");
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildTemporaryBackupPath(createdAt: Date): string {
  const timestamp = createdAt
    .toISOString()
    .replace(/[-:.]/g, "")
    .replace("Z", "");

  return path.join(
    tmpdir(),
    `fight-predict-backup-${timestamp}.sqlite`,
  );
}

async function uploadWithRetry(
  client: R2Client,
  config: BackupConfig,
  candidate: Awaited<
    ReturnType<typeof createLocalBackupCandidate>
  >,
  sleepFn: (milliseconds: number) => Promise<void>,
): Promise<VerifiedR2Backup> {
  const key = buildBackupObjectKey(
    config.r2Prefix,
    candidate.createdAt,
  );

  let putAttempts = 0;

  while (putAttempts < MAX_UPLOAD_ATTEMPTS) {
    putAttempts += 1;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.r2Bucket,
          Key: key,
          Body: createReadStream(candidate.filePath),
          ContentLength: candidate.size,
          IfNoneMatch: "*",
          Metadata: {
            "backup-format-version": "1",
            "created-at": candidate.createdAt.toISOString(),
            sha256: candidate.sha256,
            "source-environment": "production",
            "database-size": candidate.size.toString(),
          },
        }),
      );

      break;
    } catch (error) {
      if (
        putAttempts === MAX_UPLOAD_ATTEMPTS ||
        !isRetryableR2Error(error)
      ) {
        throw error;
      }

      const delay =
        INITIAL_RETRY_DELAY_MS * 2 ** (putAttempts - 1);

      await sleepFn(delay);
    }
  }

  let headAttempts = 0;

  while (headAttempts < MAX_UPLOAD_ATTEMPTS) {
    headAttempts += 1;

    try {
      return await verifyUploadedBackup(
        client,
        config,
        key,
        candidate,
      );
    } catch (error) {
      if (
        headAttempts === MAX_UPLOAD_ATTEMPTS ||
        !isRetryableR2Error(error)
      ) {
        throw error;
      }

      const delay =
        INITIAL_RETRY_DELAY_MS * 2 ** (headAttempts - 1);

      await sleepFn(delay);
    }
  }

  throw new Error("Backup verification failed.");
}

export async function runBackup(
  config: BackupConfig,
  dependencies: BackupDependencies = {},
): Promise<BackupResult> {
  const startedAt = new Date();
  const temporaryPath = buildTemporaryBackupPath(startedAt);
  const client = dependencies.r2Client ?? createR2Client(config);
  const sleepFn = dependencies.sleep ?? sleep;

  try {
    const candidate = await createLocalBackupCandidate(
      config.databasePath,
      temporaryPath,
    );

    try {
      const uploaded = await uploadWithRetry(
        client,
        config,
        candidate,
        sleepFn,
      );

      await notifyBackupSuccess(config.healthchecksPingUrl);

      return {
        ...uploaded,
        createdAt: candidate.createdAt,
      };
    } finally {
      await removeLocalBackupCandidate(candidate.filePath);
    }
  } catch (error) {
    try {
      await notifyBackupFailure(config.healthchecksPingUrl);
    } catch {
      // Monitoring failure must not hide the original backup failure.
    }

    throw error;
  }
}