import assert from "node:assert/strict";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { R2Client } from "../src/backup/r2";
import { runRestoreVerification } from "../src/backup/restoreCli";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";

const key = "production/daily/mock-test.sqlite";

const testEnvironment: Record<string, string> = {
  BACKUP_ENABLED: "true",
  R2_ENDPOINT: "http://127.0.0.1:1",
  R2_BUCKET: "mock-bucket",
  R2_ACCESS_KEY_ID: "MOCK_ACCESS_KEY",
  R2_SECRET_ACCESS_KEY: "MOCK_SECRET_KEY",
  R2_REGION: "auto",
  R2_BACKUP_PREFIX: "production/daily",
};

async function main(): Promise<void> {
  const previous = new Map(
    Object.keys(testEnvironment).map((name) => [
      name,
      process.env[name],
    ]),
  );

  try {
    for (const [name, value] of Object.entries(testEnvironment)) {
      process.env[name] = value;
    }

    let headCalls = 0;

    const client = {
      send: async (command: unknown) => {
        assert.ok(
          command instanceof HeadObjectCommand,
          "Only HEAD requests are expected.",
        );

        headCalls += 1;

        if (headCalls === 1) {
          return {};
        }

        const error = new Error("SENSITIVE_TEST_MESSAGE");
        error.name = "AccessDenied";
        throw error;
      },
    } as R2Client;

    await assert.rejects(
      runRestoreVerification(["--key", key], client),
      (error: unknown) => {
        assert.ok(error instanceof RestoreDiagnosticError);
        assert.equal(error.stage, "R2_HEAD");
        assert.equal(error.code, "ACCESS_DENIED");
        assert.ok(!error.message.includes("SENSITIVE"));
        return true;
      },
    );

    assert.equal(headCalls, 2);
    console.log("B-2d-3 second HEAD failure mock test PASS.");
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
