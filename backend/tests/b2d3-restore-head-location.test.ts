import assert from "node:assert/strict";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { R2Client } from "../src/backup/r2";
import { selectBackupObject } from "../src/backup/restoreCli";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";
import { formatRestoreError } from "../src/backup/restoreErrorOutput";

const key = "production/daily/mock-test.sqlite";

async function main(): Promise<void> {
  let headCalls = 0;
  let listCalls = 0;

  const client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        headCalls++;

        const error = new Error("SENSITIVE_SECRET_VALUE");
        error.name = "AccessDenied";

        Object.assign(error, {
          $metadata: { httpStatusCode: 403 },
        });

        throw error;
      }

      if (command instanceof ListObjectsV2Command) {
        listCalls++;
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    selectBackupObject(
      client,
      "mock-bucket",
      "production/daily",
      key,
    ),
    (error: unknown) => {
      assert.ok(error instanceof RestoreDiagnosticError);
      assert.equal(error.stage, "R2_HEAD");
      assert.equal(error.code, "ACCESS_DENIED");
      assert.equal(error.headLocation, "HEAD_1");
      assert.equal(error.httpStatus, 403);
      assert.equal(error.sdkErrorName, "AccessDenied");

      const output = formatRestoreError(error);

      assert.equal(
        output,
        "Restore verification FAILED. Stage: R2_HEAD, Code: ACCESS_DENIED, Head: HEAD_1, HTTP: 403, SDK: AccessDenied",
      );

      assert.ok(!output.includes("SENSITIVE_SECRET_VALUE"));

      return true;
    },
  );

  assert.equal(headCalls, 1);
  assert.equal(listCalls, 0);

  console.log("B-2d-3 HEAD_1 execution mock test PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
