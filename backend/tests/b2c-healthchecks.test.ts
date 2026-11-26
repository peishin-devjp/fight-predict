import assert from "node:assert/strict";
import {
  notifyBackupFailure,
  notifyBackupSuccess,
} from "../src/backup/healthchecks";

type FetchCall = {
  url: string;
  method: string | undefined;
};

async function withMockFetch(
  test: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({
      url:
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
      method: init?.method,
    });

    return new Response(null, {
      status: 200,
    });
  };

  try {
    await test(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testSuccessPing(): Promise<void> {
  await withMockFetch(async (calls) => {
    await notifyBackupSuccess(
      "https://hc.example.invalid/ping/test-id",
    );

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://hc.example.invalid/ping/test-id",
    );
    assert.equal(calls[0]?.method, "GET");
  });
}

async function testFailurePing(): Promise<void> {
  await withMockFetch(async (calls) => {
    await notifyBackupFailure(
      "https://hc.example.invalid/ping/test-id/",
    );

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://hc.example.invalid/ping/test-id/fail",
    );
    assert.equal(calls[0]?.method, "GET");
  });
}

async function testMissingUrlDoesNothing(): Promise<void> {
  await withMockFetch(async (calls) => {
    await notifyBackupSuccess(undefined);
    await notifyBackupFailure(undefined);

    assert.equal(calls.length, 0);
  });
}

async function testHttpFailureRejects(): Promise<void> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (): Promise<Response> =>
    new Response(null, {
      status: 500,
    });

  try {
    await assert.rejects(
      () =>
        notifyBackupSuccess(
          "https://hc.example.invalid/ping/test-id",
        ),
      /HTTP 500/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  await testSuccessPing();
  await testFailurePing();
  await testMissingUrlDoesNothing();
  await testHttpFailureRejects();

  console.log("B-2c Healthchecks mock tests PASS.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});