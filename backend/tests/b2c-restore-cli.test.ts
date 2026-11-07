import assert from "node:assert/strict";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { R2Client } from "../src/backup/r2";
import { listBackupObjects } from "../src/backup/restoreCli";

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

async function main(): Promise<void> {
  await testPaginationAndSort();
  await testEmptyResult();

  console.log("B-2c restore CLI mock tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});