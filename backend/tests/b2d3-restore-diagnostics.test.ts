import assert from "node:assert/strict";
import {
  classifyRestoreError,
  RestoreDiagnosticError,
  type RestoreErrorCode,
} from "../src/backup/restoreDiagnostics";

function mockError(
  name: string,
  httpStatusCode?: number,
): Error {
  const error = new Error("SENSITIVE_TEST_MESSAGE");
  error.name = name;

  if (httpStatusCode !== undefined) {
    Object.assign(error, {
      $metadata: { httpStatusCode },
    });
  }

  return error;
}

function check(
  name: string,
  status: number | undefined,
  expected: RestoreErrorCode,
): void {
  const result = classifyRestoreError(
    "R2_HEAD",
    mockError(name, status),
  );

  assert.equal(result.stage, "R2_HEAD");
  assert.equal(result.code, expected);
  assert.equal(
    result.message,
    "Restore verification failed.",
  );
  assert.ok(!result.message.includes("SENSITIVE"));
}

check("InvalidAccessKeyId", undefined, "AUTH_ERROR");
check("SignatureDoesNotMatch", undefined, "AUTH_ERROR");
check("UnknownError", 401, "AUTH_ERROR");
check("AccessDenied", undefined, "ACCESS_DENIED");
check("UnknownError", 403, "ACCESS_DENIED");
check("NoSuchKey", undefined, "NOT_FOUND");
check("UnknownError", 404, "NOT_FOUND");
check("TimeoutError", undefined, "NETWORK_ERROR");
check("NetworkingError", undefined, "NETWORK_ERROR");
check("AbortError", undefined, "NETWORK_ERROR");
check("UnknownError", undefined, "UNKNOWN_ERROR");

const existing = new RestoreDiagnosticError(
  "R2_GET",
  "NETWORK_ERROR",
);

assert.equal(
  classifyRestoreError("R2_HEAD", existing),
  existing,
);

for (const networkCode of [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
]) {
  const error = Object.assign(
    new Error("SENSITIVE_NETWORK_ERROR"),
    { code: networkCode },
  );

  const result = classifyRestoreError("R2_GET", error);

  assert.equal(result.stage, "R2_GET");
  assert.equal(result.code, "NETWORK_ERROR");
  assert.equal(result.message, "Restore verification failed.");
}
console.log("Restore diagnostics mock tests PASS.");
