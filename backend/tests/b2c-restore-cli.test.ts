import assert from "node:assert/strict";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { R2Client } from "../src/backup/r2";
import {
  listBackupObjects,
  parseRestoreArgs,
  selectBackupObject,
  withRestoreTemporaryDirectory,
} from "../src/backup/restoreCli";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";

async function testPaginationAndSort(): Promise<void> {
  let calls = 0;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (!(command instanceof ListObjectsV2Command)) {
        throw new Error("Unexpected command.");
      }

      calls += 1;

      if (calls === 1) {
        assert.equal(command.input.Bucket, "test-bucket");
        assert.equal(
          command.input.Prefix,
          "production/daily/",
        );
        assert.equal(
          command.input.ContinuationToken,
          undefined,
        );

        return {
          IsTruncated: true,
          NextContinuationToken: "page-2",
          Contents: [
            {
              Key: "production/daily/2026/11/04/older.sqlite",
              Size: 100,
              LastModified: new Date(
                "2026-11-04T03:00:00.000Z",
              ),
            },
            {
              Key: "production/daily/2026/11/04/ignore.txt",
              Size: 100,
              LastModified: new Date(
                "2026-11-04T04:00:00.000Z",
              ),
            },
          ],
        };
      }

      if (calls === 2) {
        assert.equal(
          command.input.ContinuationToken,
          "page-2",
        );

        return {
          IsTruncated: false,
          Contents: [
            {
              Key: "production/daily/2026/11/05/newer.sqlite",
              Size: 200,
              LastModified: new Date(
                "2026-11-05T03:00:00.000Z",
              ),
            },
            {
              Key: "production/daily/2026/11/05/empty.sqlite",
              Size: 0,
              LastModified: new Date(
                "2026-11-05T04:00:00.000Z",
              ),
            },
          ],
        };
      }

      throw new Error("Unexpected extra page.");
    },
  } as R2Client;

  const backups = await listBackupObjects(
    client,
    "test-bucket",
    "production/daily",
  );

  assert.equal(calls, 2);
  assert.equal(backups.length, 2);
  assert.equal(
    backups[0]?.key,
    "production/daily/2026/11/05/newer.sqlite",
  );
  assert.equal(
    backups[1]?.key,
    "production/daily/2026/11/04/older.sqlite",
  );
}

async function testEmptyResult(): Promise<void> {
  const client: R2Client = {
    send: async (command: unknown) => {
      if (!(command instanceof ListObjectsV2Command)) {
        throw new Error("Unexpected command.");
      }

      return {
        IsTruncated: false,
        Contents: [],
      };
    },
  } as R2Client;

  const backups = await listBackupObjects(
    client,
    "test-bucket",
    "production/daily",
  );

  assert.deepEqual(backups, []);
}

async function testExplicitBackupSelection(): Promise<void> {
  const key =
    "production/daily/2026/11/12/test-backup.sqlite";

  let headCalls = 0;
  let listCalls = 0;

  const client = {
    send: async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        listCalls += 1;
        throw new Error("LIST must not be called.");
      }

      if (command instanceof HeadObjectCommand) {
        headCalls += 1;
        assert.equal(command.input.Bucket, "test-bucket");
        assert.equal(command.input.Key, key);
        return { ContentLength: 100 };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  const selected = await selectBackupObject(
    client,
    "test-bucket",
    "production/daily",
    key,
  );

  assert.equal(selected.key, key);
  assert.equal(headCalls, 1);
  assert.equal(listCalls, 0);
}

async function testMissingExplicitBackup(): Promise<void> {
  const missingKey =
    "production/daily/2026/11/12/missing.sqlite";

  let headCalls = 0;
  let listCalls = 0;

  const client = {
    send: async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        headCalls += 1;
        assert.equal(command.input.Key, missingKey);

        const error = new Error("Not Found");
        error.name = "NotFound";
        throw error;
      }

      if (command instanceof ListObjectsV2Command) {
        listCalls += 1;
        throw new Error("Fallback to LIST is prohibited.");
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  await assert.rejects(
    selectBackupObject(
      client,
      "test-bucket",
      "production/daily",
      missingKey,
    ),
    {
      name: "RestoreDiagnosticError",
      stage: "R2_HEAD",
      code: "NOT_FOUND",
    },
  );

  assert.equal(headCalls, 1);
  assert.equal(listCalls, 0);
}

function testRestoreArgumentParsing(): void {
  const key =
    "production/daily/2026/11/12/test-backup.sqlite";

  // No argument: preserve latest-backup selection.
  assert.deepEqual(parseRestoreArgs([]), {});

  // Explicit backup selection.
  assert.deepEqual(parseRestoreArgs(["--key", key]), {
    objectKey: key,
  });

  // Invalid arguments must be rejected.
  const invalidArgs = [
    ["--key"],
    ["--key", ""],
    ["--unknown", key],
    ["--key", key, "extra"],
    ["--key", "../backup.sqlite"],
    ["--key", "production\\daily\\backup.sqlite"],
    ["--key", "production/daily/backup.txt"],
  ];

  for (const args of invalidArgs) {
    assert.throws(
      () => parseRestoreArgs(args),
      `Invalid arguments must be rejected: ${JSON.stringify(args)}`,
    );
  }
}

async function testTemporaryDirectoryCleanup(): Promise<void> {
  let successDirectory = "";

  // Normal completion.
  const result = await withRestoreTemporaryDirectory(
    async (directory) => {
      successDirectory = directory;

      await writeFile(
        path.join(directory, "test.sqlite"),
        "mock backup",
      );

      return "PASS";
    },
  );

  assert.equal(result, "PASS");

  await assert.rejects(
    access(successDirectory),
    { code: "ENOENT" },
    "Temporary directory must be deleted after success.",
  );

  // Failed operation.
  let failureDirectory = "";

  await assert.rejects(
    withRestoreTemporaryDirectory(async (directory) => {
      failureDirectory = directory;

      await writeFile(
        path.join(directory, "test.sqlite"),
        "mock backup",
      );

      throw new Error("Simulated validation failure");
    }),
    /Simulated validation failure/,
  );

  await assert.rejects(
    access(failureDirectory),
    { code: "ENOENT" },
    "Temporary directory must be deleted after failure.",
  );
}

async function main(): Promise<void> {
  await testPaginationAndSort();
  await testEmptyResult();
  await testExplicitBackupSelection();
  await testMissingExplicitBackup();
  testRestoreArgumentParsing();
  await testTemporaryDirectoryCleanup();

  console.log("B-2c restore CLI mock tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});