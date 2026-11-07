import assert from "node:assert/strict";
import { getBackupConfig } from "../src/backup/config";

const BACKUP_ENV_VARS = [
  "BACKUP_ENABLED",
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

function clearBackupEnv(): void {
  for (const name of BACKUP_ENV_VARS) {
    delete process.env[name];
  }
}

function testBackupDisabledWhenUnset(): void {
  clearBackupEnv();

  const result = getBackupConfig();

  assert.equal(result.enabled, false);

  if (result.enabled) {
    throw new Error("Expected backup to be disabled.");
  }

  assert.equal(result.configurationError, false);
}

function testMissingConfigDetectedWhenEnabled(): void {
  clearBackupEnv();
  process.env.BACKUP_ENABLED = "true";

  const result = getBackupConfig();

  assert.equal(result.enabled, false);

  if (result.enabled) {
    throw new Error("Expected backup configuration error.");
  }

  assert.equal(result.configurationError, true);
  assert.match(result.reason, /R2_ENDPOINT/);
  assert.match(result.reason, /R2_BUCKET/);
  assert.match(result.reason, /R2_ACCESS_KEY_ID/);
  assert.match(result.reason, /R2_SECRET_ACCESS_KEY/);
}

function testInvalidBackupEnabledValueDetected(): void {
  clearBackupEnv();
  process.env.BACKUP_ENABLED = "tru";

  const result = getBackupConfig();

  assert.equal(result.enabled, false);

  if (result.enabled) {
    throw new Error("Expected invalid BACKUP_ENABLED to be rejected.");
  }

  assert.equal(result.configurationError, true);
  assert.match(result.reason, /must be "true" or "false"/);
}

function testBackupEnabledWithCompleteConfig(): void {
  clearBackupEnv();

  process.env.BACKUP_ENABLED = "true";
  process.env.R2_ENDPOINT = "https://example.invalid";
  process.env.R2_BUCKET = "test-bucket";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";

  const result = getBackupConfig();

  assert.equal(result.enabled, true);

  if (!result.enabled) {
    throw new Error("Expected backup to be enabled.");
  }

  assert.equal(result.config.r2Bucket, "test-bucket");
}

function main(): void {
  const originalEnv = new Map<string, string | undefined>();

  for (const name of BACKUP_ENV_VARS) {
    originalEnv.set(name, process.env[name]);
  }

  try {
    testBackupDisabledWhenUnset();
    testMissingConfigDetectedWhenEnabled();
    testInvalidBackupEnabledValueDetected();
    testBackupEnabledWithCompleteConfig();

    console.log("B-2c backup config tests PASS.");
  } finally {
    for (const name of BACKUP_ENV_VARS) {
      const originalValue = originalEnv.get(name);

      if (originalValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValue;
      }
    }
  }
}

main();