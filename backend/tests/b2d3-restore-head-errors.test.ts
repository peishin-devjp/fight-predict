import assert from "node:assert/strict";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { R2Client } from "../src/backup/r2";
import { selectBackupObject } from "../src/backup/restoreCli";
import type { RestoreErrorCode } from "../src/backup/restoreDiagnostics";

const key = "production/daily/test.sqlite";

async function testHeadFailure(
  errorName: string,
  status: number | undefined,
  expectedCode: RestoreErrorCode,
): Promise<void> {
  let headCalls = 0;
  let listCalls = 0;

  const client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        headCalls += 1;

        const error = new Error("SENSITIVE_TEST_MESSAGE");
        error.name = errorName;

        if (status !== undefined) {
          Object.assign(error, {
            $metadata: { httpStatusCode: status },
          });
        }

        throw error;
      }

      if (command instanceof ListObjectsV2Command) {
        listCalls += 1;
        throw new Error("LIST must not be called.");
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    selectBackupObject(
      client,
      "test-bucket",
      "production/daily",
      key,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);

      const diagnostic = error as Error & {
        stage: string;
        code: string;
      };

      assert.equal(diagnostic.name, "RestoreDiagnosticError");
      assert.equal(diagnostic.stage, "R2_HEAD");
      assert.equal(diagnostic.code, expectedCode);
      assert.ok(!diagnostic.message.includes("SENSITIVE"));

      return true;
    },
  );

  assert.equal(headCalls, 1);
  assert.equal(listCalls, 0);
}

async function main(): Promise<void> {
  await testHeadFailure("InvalidAccessKeyId", 403, "AUTH_ERROR");
  await testHeadFailure("AccessDenied", 403, "ACCESS_DENIED");
  await testHeadFailure("NoSuchKey", 404, "NOT_FOUND");
  await testHeadFailure("TimeoutError", undefined, "NETWORK_ERROR");
  await testHeadFailure("UnknownError", 403, "ACCESS_DENIED");
  await testHeadFailure("UnknownError", undefined, "UNKNOWN_ERROR");

  console.log("B-2d-3 HEAD failure mock tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
