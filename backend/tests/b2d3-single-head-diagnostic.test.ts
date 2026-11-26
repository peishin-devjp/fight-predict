import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import {
  DIAGNOSTIC_BUCKET,
  DIAGNOSTIC_KEY,
  HeadDiagnosticConfigError,
  runSingleHeadDiagnostic,
} from "../src/backup/r2HeadDiagnostic";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";
import { formatRestoreError } from "../src/backup/restoreErrorOutput";

const account = "a".repeat(32);
const validEndpoint = `https://${account}.r2.cloudflarestorage.com`;
const secret = "SENSITIVE_SECRET_VALUE";
const names = [
  "BACKUP_ENABLED",
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_REGION",
  "DATABASE_URL",
  "BACKUP_DATABASE_PATH",
  "HEALTHCHECKS_PING_URL",
] as const;

const original = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
) as Record<string, string | undefined>;

function validEnvironment(): void {
  for (const name of names) delete process.env[name];
  process.env.BACKUP_ENABLED = "true";
  process.env.R2_ENDPOINT = validEndpoint;
  process.env.R2_BUCKET = DIAGNOSTIC_BUCKET;
  process.env.R2_ACCESS_KEY_ID = "MOCK_ACCESS_KEY";
  process.env.R2_SECRET_ACCESS_KEY = "MOCK_SECRET_KEY";
  process.env.R2_REGION = "auto";
}

function mockFactory(
  send: (command: unknown) => Promise<unknown>,
  observe?: (config: BackupConfig, attempts: number) => void,
): (config: BackupConfig, options: { maxAttempts: number }) => R2Client {
  return (config, options) => {
    assert.equal(options.maxAttempts, 1);
    observe?.(config, options.maxAttempts);
    return { send } as R2Client;
  };
}

async function expectConfigRejected(
  mutate: () => void,
): Promise<void> {
  validEnvironment();
  mutate();
  let factoryCalls = 0;

  await assert.rejects(
    runSingleHeadDiagnostic(() => {
      factoryCalls++;
      throw new Error("Factory must not be called.");
    }),
    HeadDiagnosticConfigError,
  );

  assert.equal(factoryCalls, 0);
}

async function main(): Promise<void> {
  try {
    validEnvironment();

    let calls = 0;
    let otherCommands = 0;

    await runSingleHeadDiagnostic(
      mockFactory(async (command) => {
        calls++;
        if (!(command instanceof HeadObjectCommand)) {
          otherCommands++;
          throw new Error("Unexpected command.");
        }
        assert.equal(command.input.Bucket, DIAGNOSTIC_BUCKET);
        assert.equal(command.input.Key, DIAGNOSTIC_KEY);
        return { $metadata: { httpStatusCode: 200 } };
      }),
    );

    assert.equal(calls, 1);
    assert.equal(otherCommands, 0);

    await expectConfigRejected(() => {
      delete process.env.R2_ACCESS_KEY_ID;
    });
    await expectConfigRejected(() => {
      process.env.R2_BUCKET = "wrong-bucket";
    });
    await expectConfigRejected(() => {
      process.env.R2_ENDPOINT = "http://localhost:9000";
    });
    await expectConfigRejected(() => {
      process.env.R2_ENDPOINT = "https://wrong.example.com";
    });
    await expectConfigRejected(() => {
      process.env.R2_REGION = "us-east-1";
    });
    await expectConfigRejected(() => {
      process.env.BACKUP_ENABLED = "false";
    });
    await expectConfigRejected(() => {
      process.env.DATABASE_URL = "file:production.sqlite";
    });
    await expectConfigRejected(() => {
      process.env.BACKUP_DATABASE_PATH = "production.sqlite";
    });
    await expectConfigRejected(() => {
      process.env.HEALTHCHECKS_PING_URL = "https://example.invalid";
    });

    for (const [status, errorName, expectedCode, expectedSdk] of [
      [401, "InvalidAccessKeyId", "AUTH_ERROR", "InvalidAccessKeyId"],
      [403, "AccessDenied", "ACCESS_DENIED", "AccessDenied"],
      [404, "NoSuchKey", "NOT_FOUND", "NoSuchKey"],
      [403, "UNSAFE_SECRET_NAME", "ACCESS_DENIED", "UNKNOWN"],
    ] as const) {
      validEnvironment();
      let headCalls = 0;

      await assert.rejects(
        runSingleHeadDiagnostic(
          mockFactory(async (command) => {
            assert.ok(command instanceof HeadObjectCommand);
            headCalls++;
            const error = new Error(secret);
            error.name = errorName;
            Object.assign(error, {
              $metadata: { httpStatusCode: status },
              requestHeaders: { authorization: secret },
              signature: secret,
            });
            throw error;
          }),
        ),
        (error: unknown) => {
          assert.ok(error instanceof RestoreDiagnosticError);
          assert.equal(error.code, expectedCode);
          const output = formatRestoreError(error);
          assert.ok(output.includes(`HTTP: ${status}`));
          assert.ok(output.includes(`SDK: ${expectedSdk}`));
          assert.ok(!output.includes(secret));
          assert.ok(!output.includes("UNSAFE_SECRET_NAME"));
          assert.ok(!output.includes("authorization"));
          assert.ok(!output.includes("signature"));
          return true;
        },
      );

      assert.equal(headCalls, 1);
    }

    const sourceDir = path.resolve(__dirname, "../src/backup");
    const diagnosticSource = readFileSync(
      path.join(sourceDir, "r2HeadDiagnostic.ts"),
      "utf8",
    );
    const commandSource = readFileSync(
      path.join(sourceDir, "r2HeadDiagnosticCommand.ts"),
      "utf8",
    );

    for (const source of [diagnosticSource, commandSource]) {
      assert.ok(!/from\s+["'].*restoreCli["']/.test(source));
      assert.ok(!/from\s+["'].*\/restore["']/.test(source));
      assert.ok(!/from\s+["'].*prisma/i.test(source));
      assert.ok(!/GetObjectCommand|ListObjectsV2Command|PutObjectCommand|DeleteObjectCommand/.test(source));
      assert.ok(!/dotenv|--env-file|loadEnvFile/.test(source));
    }

    assert.ok(commandSource.includes("process.env.NODE_OPTIONS"));
    console.log("B-2d-3 single HEAD diagnostic mock tests PASS.");
  } finally {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

main().catch(() => {
  console.error("B-2d-3 single HEAD diagnostic mock tests FAILED.");
  process.exitCode = 1;
});
