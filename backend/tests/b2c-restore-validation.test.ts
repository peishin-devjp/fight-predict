import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, open } from "node:fs/promises";
import { readdir, rm, stat } from "node:fs/promises";
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

async function testWorkingCopyCleanup(): Promise<void> {
  const directory = path.dirname(databasePath);
  const workingFilePrefix = "restore-working-";

  const listWorkingFiles = async (): Promise<string[]> => {
    const entries = await readdir(directory);
    return entries.filter(
      (name) =>
        name.startsWith(workingFilePrefix) &&
        name.endsWith(".sqlite"),
    );
  };

  const before = await listWorkingFiles();

  const fileStat = await stat(databasePath);
  const sha256 = await calculateSha256(databasePath);

  await validateDownloadedBackup(
    databasePath,
    sha256,
    fileStat.size,
    migrationsDirectory,
  );

  const after = await listWorkingFiles();

  assert.deepEqual(
    after,
    before,
    "Validation must remove its temporary working copy.",
  );
}

async function testCorruptedSqliteRejected(): Promise<void> {
  const corruptedPath = path.resolve(
    "prisma/b2c-restore-corrupted-test.sqlite",
  );

  await copyFile(databasePath, corruptedPath);

  try {
    // Overwrite the SQLite file header to simulate corruption.
    const file = await open(corruptedPath, "r+");

    try {
      const invalidHeader = Buffer.alloc(16, 0);
      await file.write(invalidHeader, 0, 16, 0);
    } finally {
      await file.close();
    }

    const fileStat = await stat(corruptedPath);
    const sha256 = await calculateSha256(corruptedPath);

    await assert.rejects(
      () =>
        validateDownloadedBackup(
          corruptedPath,
          sha256,
          fileStat.size,
          migrationsDirectory,
        ),
      "Corrupted SQLite must be rejected.",
    );
  } finally {
    await rm(corruptedPath, { force: true });
  }
}

async function testWorkingCopyCleanupOnFailure(): Promise<void> {
  const directory = path.dirname(databasePath);
  const workingFilePrefix = "restore-working-";

  const listWorkingFiles = async (): Promise<string[]> => {
    const entries = await readdir(directory);

    return entries
      .filter(
        (name) =>
          name.startsWith(workingFilePrefix) &&
          name.endsWith(".sqlite"),
      )
      .sort();
  };

  const before = await listWorkingFiles();

  const corruptedPath = path.resolve(
    "prisma/b2c-restore-cleanup-failure-test.sqlite",
  );

  await copyFile(databasePath, corruptedPath);

  try {
    const file = await open(corruptedPath, "r+");

    try {
      await file.write(Buffer.alloc(16, 0), 0, 16, 0);
    } finally {
      await file.close();
    }

    const fileStat = await stat(corruptedPath);
    const sha256 = await calculateSha256(corruptedPath);

    await assert.rejects(
      () =>
        validateDownloadedBackup(
          corruptedPath,
          sha256,
          fileStat.size,
          migrationsDirectory,
        ),
    );

    const after = await listWorkingFiles();

    assert.deepEqual(
      after,
      before,
      "Failed validation must remove its working copy.",
    );
  } finally {
    await rm(corruptedPath, { force: true });
  }
}

async function testOriginalBackupUnchanged(): Promise<void> {
  const beforeStat = await stat(databasePath);
  const beforeSha256 = await calculateSha256(databasePath);

  await validateDownloadedBackup(
    databasePath,
    beforeSha256,
    beforeStat.size,
    migrationsDirectory,
  );

  const afterStat = await stat(databasePath);
  const afterSha256 = await calculateSha256(databasePath);

  assert.equal(
    afterStat.size,
    beforeStat.size,
    "Original backup size must remain unchanged.",
  );

  assert.equal(
    afterSha256,
    beforeSha256,
    "Original backup SHA-256 must remain unchanged.",
  );
}

async function testOriginalBackupUnchangedOnFailure(): Promise<void> {
  const corruptedPath = path.resolve(
    "prisma/b2c-restore-immutable-failure-test.sqlite",
  );

  await copyFile(databasePath, corruptedPath);

  try {
    const file = await open(corruptedPath, "r+");

    try {
      await file.write(Buffer.alloc(16, 0), 0, 16, 0);
    } finally {
      await file.close();
    }

    const beforeStat = await stat(corruptedPath);
    const beforeSha256 = await calculateSha256(corruptedPath);

    await assert.rejects(
      () =>
        validateDownloadedBackup(
          corruptedPath,
          beforeSha256,
          beforeStat.size,
          migrationsDirectory,
        ),
      "Corrupted SQLite must be rejected.",
    );

    const afterStat = await stat(corruptedPath);
    const afterSha256 = await calculateSha256(corruptedPath);

    assert.equal(
      afterStat.size,
      beforeStat.size,
      "Original backup size must remain unchanged after failure.",
    );

    assert.equal(
      afterSha256,
      beforeSha256,
      "Original backup SHA-256 must remain unchanged after failure.",
    );
  } finally {
    await rm(corruptedPath, { force: true });
  }
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
    await testWorkingCopyCleanup();
    await testCorruptedSqliteRejected();
    await testWorkingCopyCleanupOnFailure();
    await testOriginalBackupUnchanged();
    await testOriginalBackupUnchangedOnFailure();
    
    console.log("B-2c restore validation tests PASS.");
  } finally {
    await rm(databasePath, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});