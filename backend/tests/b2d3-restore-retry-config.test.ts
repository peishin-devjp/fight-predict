import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createR2Client } from "../src/backup/r2";

async function main(): Promise<void> {
  const config = {
    databasePath: "dummy.sqlite",
    r2Region: "auto",
    r2Endpoint: "https://example.invalid",
    r2Bucket: "dummy",
    r2AccessKeyId: "DUMMY",
    r2SecretAccessKey: "DUMMY",
    r2Prefix: "dummy",
  };

  const backup = createR2Client(config);
  const restore = createR2Client(config, { maxAttempts: 1 });

  try {
    const backupAttempts = await backup.config.maxAttempts();
    const restoreAttempts = await restore.config.maxAttempts();

    assert.equal(
      backupAttempts,
      3,
      "Backup client must retain the SDK default retry count",
    );

    assert.equal(
      restoreAttempts,
      1,
      "Restore client must disable SDK retries",
    );

    const restoreCliSource = readFileSync(
      join(__dirname, "../src/backup/restoreCli.ts"),
      "utf8",
    );

    assert.match(
      restoreCliSource,
      /injectedClient\s*\?\?\s*createR2Client\(config,\s*\{\s*maxAttempts:\s*1\s*\}\)/,
      "Restore CLI must explicitly set maxAttempts to 1",
    );

    console.log("B-2d-3 restore retry configuration tests PASS.");
  } finally {
    backup.destroy();
    restore.destroy();
  }
}

main().catch(() => {
  console.error("B-2d-3 restore retry configuration tests FAILED.");
  process.exitCode = 1;
});
