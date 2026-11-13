import assert from "node:assert/strict";
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import { downloadBackupForValidation } from "../src/backup/restore";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";
import { formatRestoreError } from "../src/backup/restoreErrorOutput";

async function main(): Promise<void> {
  let headCalls = 0;
  let getCalls = 0;

  const client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        headCalls++;
        const error = new Error("SENSITIVE_SECRET_VALUE");
        error.name = "AccessDenied";
        Object.assign(error, { $metadata: { httpStatusCode: 403 } });
        throw error;
      }

      if (command instanceof GetObjectCommand) {
        getCalls++;
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const config = {
    r2Bucket: "mock-bucket",
  } as BackupConfig;

  await assert.rejects(
    downloadBackupForValidation(
      client,
      config,
      "production/daily/mock-test.sqlite",
      "mock-output.sqlite",
    ),
    (error: unknown) => {
      assert.ok(error instanceof RestoreDiagnosticError);
      assert.equal(error.stage, "R2_HEAD");
      assert.equal(error.code, "ACCESS_DENIED");
      assert.equal(error.headLocation, "HEAD_3");
      assert.equal(error.httpStatus, 403);
      assert.equal(error.sdkErrorName, "AccessDenied");

      const output = formatRestoreError(error);
      assert.ok(output.includes("Head: HEAD_3"));
      assert.ok(output.includes("HTTP: 403"));
      assert.ok(output.includes("SDK: AccessDenied"));
      assert.ok(!output.includes("SENSITIVE_SECRET_VALUE"));
      return true;
    },
  );

  assert.equal(headCalls, 1);
  assert.equal(getCalls, 0);

  console.log("B-2d-3 HEAD_3 execution mock test PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
