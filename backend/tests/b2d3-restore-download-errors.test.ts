import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import { downloadBackupForValidation } from "../src/backup/restore";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";

const config: BackupConfig = {
  databasePath: "unused.sqlite",
  r2Endpoint: "https://example.invalid",
  r2Region: "auto",
  r2Bucket: "test-bucket",
  r2AccessKeyId: "test-access-key",
  r2SecretAccessKey: "test-secret-key",
  r2Prefix: "production/daily",
};

const key = "production/daily/mock-backup.sqlite";
async function main(): Promise<void> {
  const tempDirectory = await mkdtemp(
    path.resolve("tests/b2d3-restore-download-errors-"),
  );
  const outputPath = path.join(tempDirectory, "output.sqlite");

  let headCalls = 0;
  let getCalls = 0;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        headCalls += 1;
        return {
          ContentLength: 100,
          Metadata: {
            sha256: "a".repeat(64),
          },
        };
      }

      if (command instanceof GetObjectCommand) {
        getCalls += 1;

        return {
          Body: Readable.from(
            (async function* () {
              yield Buffer.from("partial backup");
              throw new Error("SENSITIVE_STREAM_ERROR");
            })(),
          ),
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  try {
    await assert.rejects(
      () =>
        downloadBackupForValidation(
          client,
          config,
          key,
          outputPath,
        ),
      (error: unknown) => {
        assert.ok(error instanceof RestoreDiagnosticError);
        assert.equal(error.stage, "DOWNLOAD");
        assert.equal(error.code, "UNKNOWN_ERROR");
        assert.equal(error.message, "Restore verification failed.");
        assert.equal(
          JSON.stringify(error).includes("SENSITIVE_STREAM_ERROR"),
          false,
        );
        return true;
      },
    );

    assert.equal(headCalls, 1);
    assert.equal(getCalls, 1);

    console.log("B-2d-3 restore DOWNLOAD error mock test PASS.");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch(() => {
  console.error("B-2d-3 restore DOWNLOAD error mock test FAILED.");
  process.exitCode = 1;
});
