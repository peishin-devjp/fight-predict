import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { rm, readFile } from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import { downloadBackupForValidation } from "../src/backup/restore";

const config: BackupConfig = {
  databasePath: "unused.sqlite",
  r2Endpoint: "https://example.invalid",
  r2Region: "auto",
  r2Bucket: "test-bucket",
  r2AccessKeyId: "test-access-key",
  r2SecretAccessKey: "test-secret-key",
  r2Prefix: "production/daily",
};

const key =
  "production/daily/2026/11/05/fight-predict-20261105T030012Z.sqlite";

const sha256 =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function testDownload(): Promise<void> {
  const body = Buffer.from("mock sqlite backup");
  const outputPath = path.resolve(
    "tests/b2c-restore-download-output.sqlite",
  );

  await rm(outputPath, { force: true });

  let headCalls = 0;
  let getCalls = 0;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        headCalls += 1;

        return {
          ContentLength: body.length,
          Metadata: {
            sha256,
          },
        };
      }

      if (command instanceof GetObjectCommand) {
        getCalls += 1;

        return {
          Body: Readable.from(body),
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  try {
    const result = await downloadBackupForValidation(
      client,
      config,
      key,
      outputPath,
    );

    assert.equal(headCalls, 1);
    assert.equal(getCalls, 1);
    assert.equal(result.filePath, outputPath);
    assert.equal(result.key, key);
    assert.equal(result.size, body.length);
    assert.equal(result.sha256, sha256);

    const downloaded = await readFile(outputPath);
    assert.deepEqual(downloaded, body);
  } finally {
    await rm(outputPath, { force: true });
  }
}

async function testInvalidHeadMetadataRejected(): Promise<void> {
  const outputPath = path.resolve(
    "tests/b2c-restore-download-invalid.sqlite",
  );

  await rm(outputPath, { force: true });

  let getCalls = 0;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 123,
          Metadata: {
            sha256: "invalid",
          },
        };
      }

      if (command instanceof GetObjectCommand) {
        getCalls += 1;
        return {
          Body: Readable.from(Buffer.from("should not download")),
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    () =>
      downloadBackupForValidation(
        client,
        config,
        key,
        outputPath,
      ),
    /invalid SHA-256 metadata/,
  );

  assert.equal(getCalls, 0);
}

async function main(): Promise<void> {
  await testDownload();
  await testInvalidHeadMetadataRejected();

  console.log("B-2c restore download mock tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});