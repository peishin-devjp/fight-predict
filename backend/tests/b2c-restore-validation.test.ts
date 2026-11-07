import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { validateDownloadedBackup } from "../src/backup/restore";

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function testValidBackup(): Promise<void> {
    const databasePath = path.resolve("prisma/b1a-audit.db");
    const migrationsDirectory = path.resolve("prisma/migrations");

    const fileStat = await stat(databasePath);
    const sha256 = await calculateSha256(databasePath);

    const result = await validateDownloadedBackup(
        databasePath,
        sha256,
        fileStat.size,
        migrationsDirectory,
    );

    assert.equal(result.filePath, databasePath);
    assert.equal(result.size, fileStat.size);
    assert.equal(result.sha256, sha256);
    assert.ok(result.migrations.length > 0);
}

async function testWrongSizeRejected(): Promise<void> {
  const databasePath = path.resolve("prisma/b1a-audit.db");
  const migrationsDirectory = path.resolve("prisma/migrations");

  const fileStat = await stat(databasePath);
  const sha256 = await calculateSha256(databasePath);

  await assert.rejects(
    () =>
      validateDownloadedBackup(
        databasePath,
        sha256,
        fileStat.size + 1,
        migrationsDirectory,
      ),
    /size does not match/,
  );
}

async function testWrongShaRejected(): Promise<void> {
  const databasePath = path.resolve("prisma/b1a-audit.db");
  const migrationsDirectory = path.resolve("prisma/migrations");

  const fileStat = await stat(databasePath);

  await assert.rejects(
    () =>
      validateDownloadedBackup(
        databasePath,
        "0".repeat(64),
        fileStat.size,
        migrationsDirectory,
      ),
    /SHA-256 does not match/,
  );
}

async function main(): Promise<void> {
  await testValidBackup();
  await testWrongSizeRejected();
  await testWrongShaRejected();

  console.log("B-2c restore validation tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});