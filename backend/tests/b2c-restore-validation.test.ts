import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { validateDownloadedBackup } from "../src/backup/restore";

const databasePath = path.resolve(
  "prisma/b2c-restore-validation-test.sqlite",
);
const migrationsDirectory = path.resolve("prisma/migrations");

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function testValidBackup(): Promise<void> {
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
  await rm(databasePath, { force: true });

  const database = new DatabaseSync(databasePath);

  try {
    database.exec(`
      CREATE TABLE "User" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "Event" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "Fighter" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "Fight" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "Prediction" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "Session" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "EmailVerificationToken" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "PasswordResetToken" (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE "_prisma_migrations" (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        finished_at DATETIME,
        migration_name TEXT NOT NULL,
        logs TEXT,
        rolled_back_at DATETIME,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    const insertMigration = database.prepare(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
    );

    const migrations = await import("node:fs/promises").then(
      ({ readdir }) =>
        readdir(migrationsDirectory, {
          withFileTypes: true,
        }),
    );

    for (const migration of migrations) {
      if (!migration.isDirectory()) {
        continue;
      }

      insertMigration.run(
        migration.name,
        "test-checksum",
        migration.name,
      );
    }
  } finally {
    database.close();
  }

  try {
    await testValidBackup();
    await testWrongSizeRejected();
    await testWrongShaRejected();

    console.log("B-2c restore validation tests PASS.");
  } finally {
    await rm(databasePath, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});