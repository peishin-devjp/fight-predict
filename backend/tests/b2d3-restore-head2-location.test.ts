import assert from "node:assert/strict";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { R2Client } from "../src/backup/r2";
import { runRestoreVerification } from "../src/backup/restoreCli";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";
import { formatRestoreError } from "../src/backup/restoreErrorOutput";

const key = "production/daily/mock-test.sqlite";

async function main(): Promise<void> {
  const env = {
    BACKUP_ENABLED: process.env.BACKUP_ENABLED,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_PREFIX: process.env.R2_PREFIX,
  };

  let headCalls = 0;
  let otherCalls = 0;

  try {
    process.env.BACKUP_ENABLED = "true";
    process.env.R2_ENDPOINT = "https://mock.example.invalid";
    process.env.R2_BUCKET = "mock-bucket";
    process.env.R2_ACCESS_KEY_ID = "MOCK_ACCESS_KEY";
    process.env.R2_SECRET_ACCESS_KEY = "MOCK_SECRET_KEY";
    process.env.R2_PREFIX = "production/daily";

    const client = {
      send: async (command: unknown) => {
        if (command instanceof HeadObjectCommand) {
          headCalls++;

          if (headCalls === 1) {
            return { $metadata: { httpStatusCode: 200 } };
          }

          const error = new Error("SENSITIVE_SECRET_VALUE");
          error.name = "AccessDenied";
          Object.assign(error, {
            $metadata: { httpStatusCode: 403 },
          });
          throw error;
        }

        otherCalls++;
        throw new Error("Unexpected command.");
      },
    } as R2Client;

    await assert.rejects(
      runRestoreVerification(["--key", key], client),
      (error: unknown) => {
        assert.ok(error instanceof RestoreDiagnosticError);
        assert.equal(error.stage, "R2_HEAD");
        assert.equal(error.code, "ACCESS_DENIED");
        assert.equal(error.headLocation, "HEAD_2");
        assert.equal(error.httpStatus, 403);
        assert.equal(error.sdkErrorName, "AccessDenied");

        const output = formatRestoreError(error);
        assert.ok(output.includes("Head: HEAD_2"));
        assert.ok(output.includes("HTTP: 403"));
        assert.ok(output.includes("SDK: AccessDenied"));
        assert.ok(!output.includes("SENSITIVE_SECRET_VALUE"));
        return true;
      },
    );

    assert.equal(headCalls, 2);
    assert.equal(otherCalls, 0);

    console.log("B-2d-3 HEAD_2 execution mock test PASS.");
  } finally {
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
