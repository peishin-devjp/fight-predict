import assert from "node:assert/strict";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import { startBackupScheduler } from "../src/backup/scheduler";

const config: BackupConfig = {
  databasePath: "unused.sqlite",
  r2Endpoint: "https://example.invalid",
  r2Region: "auto",
  r2Bucket: "test-bucket",
  r2AccessKeyId: "test-access-key",
  r2SecretAccessKey: "test-secret-key",
  r2Prefix: "production/daily",
};

function createEmptyR2Client(): R2Client {
  return {
    send: async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [],
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;
}

async function testBeforeTargetDoesNotRun(): Promise<void> {
  let backupRuns = 0;

  const scheduler = startBackupScheduler(config, {
    r2Client: createEmptyR2Client(),
    now: () => new Date("2026-11-05T02:59:00.000Z"),
    runBackupFn: async () => {
      backupRuns += 1;

      return {
        key: "unused",
        size: 1,
        sha256: "unused",
        createdAt: new Date(),
      };
    },
  });

  try {
    await scheduler.initialCheck;
    assert.equal(backupRuns, 0);
  } finally {
    scheduler.stop();
  }
}

async function testAfterTargetWithoutBackupRuns(): Promise<void> {
  let backupRuns = 0;

  const scheduler = startBackupScheduler(config, {
    r2Client: createEmptyR2Client(),
    now: () => new Date("2026-11-05T03:00:00.000Z"),
    runBackupFn: async () => {
      backupRuns += 1;

      return {
        key: "test-key",
        size: 123,
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        createdAt: new Date("2026-11-05T03:00:00.000Z"),
      };
    },
  });

  try {
    await scheduler.initialCheck;
    assert.equal(backupRuns, 1);
  } finally {
    scheduler.stop();
  }
}

async function testExistingVerifiedBackupDoesNotRun(): Promise<void> {
  let backupRuns = 0;

  const sha256 =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [
            {
              Key: "production/daily/2026/11/05/existing.sqlite",
              Size: 123,
            },
          ],
        };
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 123,
          Metadata: {
            "backup-format-version": "1",
            sha256,
            "source-environment": "production",
            "database-size": "123",
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const scheduler = startBackupScheduler(config, {
    r2Client: client,
    now: () => new Date("2026-11-05T12:00:00.000Z"),
    runBackupFn: async () => {
      backupRuns += 1;

      return {
        key: "unused",
        size: 1,
        sha256: "unused",
        createdAt: new Date(),
      };
    },
  });

  try {
    await scheduler.initialCheck;
    assert.equal(backupRuns, 0);
  } finally {
    scheduler.stop();
  }
}

async function main(): Promise<void> {
  await testBeforeTargetDoesNotRun();
  await testAfterTargetWithoutBackupRuns();
  await testExistingVerifiedBackupDoesNotRun();

  console.log("B-2c scheduler mock tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});