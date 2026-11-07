import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createLocalBackupCandidate,
  removeLocalBackupCandidate,
} from "../src/backup/sqliteBackup";

async function main(): Promise<void> {
  const sourcePath = path.resolve("prisma/b1a-audit.db");
  const candidatePath = path.resolve(
    "prisma/b2c-readonly-test.sqlite",
  );

  await rm(candidatePath, { force: true });

  try {
    const candidate = await createLocalBackupCandidate(
      sourcePath,
      candidatePath,
    );

    assert.equal(candidate.filePath, candidatePath);
    assert.ok(candidate.size > 0);
    assert.match(candidate.sha256, /^[0-9a-f]{64}$/);

    const database = new DatabaseSync(candidatePath, {
      readOnly: true,
    });

    try {
      const integrityResult = database
        .prepare("PRAGMA integrity_check;")
        .get() as { integrity_check?: unknown } | undefined;

      assert.equal(integrityResult?.integrity_check, "ok");

      assert.throws(
        () => {
          database.exec(
            "CREATE TABLE readonly_test (id INTEGER PRIMARY KEY);",
          );
        },
        /readonly|read-only/i,
      );
    } finally {
      database.close();
    }

    console.log("B-2c SQLite read-only tests PASS.");
  } finally {
    await removeLocalBackupCandidate(candidatePath);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});