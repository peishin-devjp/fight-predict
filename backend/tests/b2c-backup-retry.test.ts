import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import { runBackup } from "../src/backup/backup";

const databasePath = path.resolve(
  "prisma/b2c-backup-retry-source-test.sqlite",
);

const config: BackupConfig = {
  databasePath,
  r2Endpoint: "https://example.invalid",
  r2Region: "auto",
  r2Bucket: "test-bucket",
  r2AccessKeyId: "test-access-key",
  r2SecretAccessKey: "test-secret-key",
  r2Prefix: "production/daily",
};

function transientError(): Error & {
  $metadata: { httpStatusCode: number };
} {
  const error = new Error("Temporary R2 failure") as Error & {
    $metadata: { httpStatusCode: number };
  };

  error.$metadata = {
    httpStatusCode: 503,
  };

  return error;
}

async function testTransientPutFailureRetries(): Promise<void> {
  let putAttempts = 0;
  let headAttempts = 0;
  const sleepCalls: number[] = [];
  let uploadedSize: number | undefined;
  let uploadedSha256: string | undefined;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        putAttempts += 1;

        if (putAttempts < 3) {
          throw transientError();
        }

        uploadedSize = command.input.ContentLength;
        uploadedSha256 = command.input.Metadata?.sha256;

        return {};
      }

      if (command instanceof HeadObjectCommand) {
        headAttempts += 1;

        assert.notEqual(uploadedSize, undefined);
        assert.notEqual(uploadedSha256, undefined);

        return {
          ContentLength: uploadedSize,
          Metadata: {
            "backup-format-version": "1",
            sha256: uploadedSha256,
            "source-environment": "production",
            "database-size": String(uploadedSize),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const result = await runBackup(config, {
    r2Client: client,
    sleep: async (milliseconds) => {
      sleepCalls.push(milliseconds);
    },
  });

  assert.equal(putAttempts, 3);
  assert.equal(headAttempts, 1);
  assert.deepEqual(sleepCalls, [1000, 2000]);
  assert.equal(result.size, uploadedSize);
}

async function testLogicalPutFailureDoesNotRetry(): Promise<void> {
  let putAttempts = 0;
  const sleepCalls: number[] = [];

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        putAttempts += 1;

        const error = new Error("Precondition failed") as Error & {
          $metadata: { httpStatusCode: number };
        };

        error.$metadata = {
          httpStatusCode: 412,
        };

        throw error;
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    () =>
      runBackup(config, {
        r2Client: client,
        sleep: async (milliseconds) => {
          sleepCalls.push(milliseconds);
        },
      }),
  );

  assert.equal(putAttempts, 1);
  assert.deepEqual(sleepCalls, []);
}

async function testTransientHeadFailureAfterSuccessfulPut(): Promise<void> {
  let putAttempts = 0;
  let headAttempts = 0;
  const sleepCalls: number[] = [];
  let uploadedSize: number | undefined;
  let uploadedSha256: string | undefined;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        putAttempts += 1;
        uploadedSize = command.input.ContentLength;
        uploadedSha256 = command.input.Metadata?.sha256;
        return {};
      }

      if (command instanceof HeadObjectCommand) {
        headAttempts += 1;

        if (headAttempts === 1) {
          throw transientError();
        }

        assert.notEqual(uploadedSize, undefined);
        assert.notEqual(uploadedSha256, undefined);

        return {
          ContentLength: uploadedSize,
          Metadata: {
            "backup-format-version": "1",
            sha256: uploadedSha256,
            "source-environment": "production",
            "database-size": String(uploadedSize),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const result = await runBackup(config, {
    r2Client: client,
    sleep: async (milliseconds) => {
      sleepCalls.push(milliseconds);
    },
  });

  assert.equal(putAttempts, 1);
  assert.equal(headAttempts, 2);
  assert.deepEqual(sleepCalls, [1000]);
  assert.equal(result.size, uploadedSize);
}

async function main(): Promise<void> {
  await rm(databasePath, { force: true });

  const sourceDatabase = new DatabaseSync(databasePath);

  try {
    sourceDatabase.exec(
      "CREATE TABLE backup_test (id INTEGER PRIMARY KEY); INSERT INTO backup_test DEFAULT VALUES;",
    );
  } finally {
    sourceDatabase.close();
  }

  try {
    await testTransientPutFailureRetries();
    await testLogicalPutFailureDoesNotRetry();
    await testTransientHeadFailureAfterSuccessfulPut();

    console.log("B-2c backup retry tests PASS.");
  } finally {
    await rm(databasePath, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});