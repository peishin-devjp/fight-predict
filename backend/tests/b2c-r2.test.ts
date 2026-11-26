import assert from "node:assert/strict";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { LocalBackupCandidate } from "../src/backup/sqliteBackup";
import {
  buildBackupObjectKey,
  hasVerifiedBackupForUtcDate,
  uploadAndVerifyBackup,
  type R2Client,
} from "../src/backup/r2";

const config: BackupConfig = {
  databasePath: "unused.sqlite",
  r2Endpoint: "https://example.invalid",
  r2Region: "auto",
  r2Bucket: "test-bucket",
  r2AccessKeyId: "test-access-key",
  r2SecretAccessKey: "test-secret-key",
  r2Prefix: "production/daily",
};

const candidate: LocalBackupCandidate = {
  filePath: __filename,
  size: 12345,
  sha256:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  createdAt: new Date("2026-11-05T03:00:12.000Z"),
};

async function testObjectKey(): Promise<void> {
  const key = buildBackupObjectKey(
    config.r2Prefix,
    candidate.createdAt,
  );

  assert.equal(
    key,
    "production/daily/2026/11/05/fight-predict-20261105T030012Z.sqlite",
  );
}

async function testSuccessfulHeadVerification(): Promise<void> {
  let putSeen = false;
  let headSeen = false;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        putSeen = true;

        assert.equal(command.input.Bucket, "test-bucket");
        assert.equal(
          command.input.Key,
          "production/daily/2026/11/05/fight-predict-20261105T030012Z.sqlite",
        );
        assert.equal(command.input.IfNoneMatch, "*");
        assert.equal(command.input.ContentLength, candidate.size);
        assert.equal(
          command.input.Metadata?.sha256,
          candidate.sha256,
        );

        return {};
      }

      if (command instanceof HeadObjectCommand) {
        headSeen = true;

        return {
          ContentLength: candidate.size,
          Metadata: {
            "backup-format-version": "1",
            "created-at": candidate.createdAt.toISOString(),
            sha256: candidate.sha256,
            "source-environment": "production",
            "database-size": candidate.size.toString(),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const result = await uploadAndVerifyBackup(
    client,
    config,
    candidate,
  );

  assert.equal(putSeen, true);
  assert.equal(headSeen, true);
  assert.equal(result.size, candidate.size);
  assert.equal(result.sha256, candidate.sha256);
}

async function testHeadShaMismatchFails(): Promise<void> {
  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        return {};
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: candidate.size,
          Metadata: {
            "backup-format-version": "1",
            sha256:
              "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            "source-environment": "production",
            "database-size": candidate.size.toString(),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    () => uploadAndVerifyBackup(client, config, candidate),
    /SHA-256 metadata mismatch/,
  );
}

async function testHeadSizeMismatchFails(): Promise<void> {
  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        return {};
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: candidate.size + 1,
          Metadata: {
            "backup-format-version": "1",
            sha256: candidate.sha256,
            "source-environment": "production",
            "database-size": candidate.size.toString(),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    () => uploadAndVerifyBackup(client, config, candidate),
    /size mismatch/,
  );
}

async function testVerifiedDailyBackupExists(): Promise<void> {
  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        assert.equal(
          command.input.Prefix,
          "production/daily/2026/11/05/",
        );

        return {
          Contents: [
            {
              Key: "production/daily/2026/11/05/valid.sqlite",
              Size: candidate.size,
            },
          ],
        };
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: candidate.size,
          Metadata: {
            "backup-format-version": "1",
            sha256: candidate.sha256,
            "source-environment": "production",
            "database-size": candidate.size.toString(),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const result = await hasVerifiedBackupForUtcDate(
    client,
    config,
    new Date("2026-11-05T12:00:00.000Z"),
  );

  assert.equal(result, true);
}

async function testInvalidDailyBackupDoesNotCount(): Promise<void> {
  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [
            {
              Key: "production/daily/2026/11/05/invalid.sqlite",
              Size: candidate.size,
            },
          ],
        };
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: candidate.size,
          Metadata: {
            "backup-format-version": "1",
            sha256: "invalid",
            "source-environment": "production",
            "database-size": candidate.size.toString(),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const result = await hasVerifiedBackupForUtcDate(
    client,
    config,
    new Date("2026-11-05T12:00:00.000Z"),
  );

  assert.equal(result, false);
}

async function main(): Promise<void> {
  await testObjectKey();
  await testSuccessfulHeadVerification();
  await testHeadShaMismatchFails();
  await testHeadSizeMismatchFails();
  await testVerifiedDailyBackupExists();
  await testInvalidDailyBackupDoesNotCount();

  console.log("B-2c mock R2 tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});