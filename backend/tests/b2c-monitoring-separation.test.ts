import assert from "node:assert/strict";
import {
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "../src/backup/config";
import type { R2Client } from "../src/backup/r2";
import { runBackup } from "../src/backup/backup";

const config: BackupConfig = {
  databasePath: "prisma/b1a-audit.db",
  r2Endpoint: "https://example.invalid",
  r2Region: "auto",
  r2Bucket: "test-bucket",
  r2AccessKeyId: "test-access-key",
  r2SecretAccessKey: "test-secret-key",
  r2Prefix: "production/daily",
  healthchecksPingUrl:
    "https://hc.example.invalid/ping/test-id",
};

async function main(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const healthchecksCalls: string[] = [];

  let uploadedSize: number | undefined;
  let uploadedSha256: string | undefined;

  const client: R2Client = {
    send: async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        uploadedSize = command.input.ContentLength;
        uploadedSha256 = command.input.Metadata?.sha256;
        return {};
      }

      if (command instanceof HeadObjectCommand) {
        assert.notEqual(uploadedSize, undefined);
        assert.notEqual(uploadedSha256, undefined);

        return {
          ContentLength: uploadedSize,
          Metadata: {
            "backup-format-version": "1",
            sha256: uploadedSha256,
            "source-environment": "production",
            "database-size": String(uploadedSize),
          },
        };
      }

      throw new Error("Unexpected command.");
    },
  } as R2Client;

  globalThis.fetch = async (
    input: string | URL | Request,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    healthchecksCalls.push(url);

    return new Response(null, {
      status: 500,
    });
  };

  try {
    const result = await runBackup(config, {
      r2Client: client,
      sleep: async () => {},
    });

    assert.equal(result.size, uploadedSize);

    assert.deepEqual(healthchecksCalls, [
      "https://hc.example.invalid/ping/test-id",
    ]);

    assert.equal(
      healthchecksCalls.some((url) => url.endsWith("/fail")),
      false,
    );

    console.log(
      "B-2c monitoring separation tests PASS.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});