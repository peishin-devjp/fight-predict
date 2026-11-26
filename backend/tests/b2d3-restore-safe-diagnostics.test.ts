import assert from "node:assert/strict";
import {
  classifyRestoreError,
  type RestoreHeadLocation,
  type RestoreErrorCode,
} from "../src/backup/restoreDiagnostics";
import { formatRestoreError } from "../src/backup/restoreErrorOutput";

const SECRET = "SENSITIVE_SECRET_VALUE";
const ACCESS_KEY = "SENSITIVE_ACCESS_KEY";
const HEADER = "SENSITIVE_AUTHORIZATION_HEADER";

function check(
  head: RestoreHeadLocation,
  name: string,
  status: unknown,
  expectedCode: RestoreErrorCode,
  expectedSdk: string,
  expectedHttp: string,
): void {
  const error = Object.assign(
    new Error(`${SECRET} ${ACCESS_KEY} ${HEADER}`),
    {
      name,
      $metadata: { httpStatusCode: status },
      requestHeaders: { authorization: HEADER },
    },
  );

  const diagnostic = classifyRestoreError("R2_HEAD", error, head);
  const output = formatRestoreError(diagnostic);

  assert.equal(diagnostic.code, expectedCode);
  assert.equal(diagnostic.headLocation, head);
  assert.ok(output.includes(`Head: ${head}`));
  assert.ok(output.includes(`HTTP: ${expectedHttp}`));
  assert.ok(output.includes(`SDK: ${expectedSdk}`));

  for (const sensitive of [SECRET, ACCESS_KEY, HEADER]) {
    assert.ok(!output.includes(sensitive));
    assert.ok(!diagnostic.message.includes(sensitive));
  }

  assert.ok(!output.includes("requestHeaders"));
  assert.ok(!output.includes("authorization"));
}

check("HEAD_1", "AccessDenied", 403, "ACCESS_DENIED", "AccessDenied", "403");
check("HEAD_2", "InvalidAccessKeyId", 403, "AUTH_ERROR", "InvalidAccessKeyId", "403");
check("HEAD_3", "SignatureDoesNotMatch", 401, "AUTH_ERROR", "SignatureDoesNotMatch", "401");
check("HEAD_1", "NoSuchKey", 404, "NOT_FOUND", "NoSuchKey", "404");
check("HEAD_2", "NotFound", 404, "NOT_FOUND", "NotFound", "404");

check("HEAD_3", "SENSITIVE_UNKNOWN_ERROR_NAME", 403, "ACCESS_DENIED", "UNKNOWN", "403");
check("HEAD_1", "SENSITIVE_UNKNOWN_ERROR_NAME", undefined, "UNKNOWN_ERROR", "UNKNOWN", "UNKNOWN");
check("HEAD_2", "SENSITIVE_UNKNOWN_ERROR_NAME", 999, "UNKNOWN_ERROR", "UNKNOWN", "UNKNOWN");
check("HEAD_3", "SENSITIVE_UNKNOWN_ERROR_NAME", "403", "UNKNOWN_ERROR", "UNKNOWN", "UNKNOWN");

const nonHead = classifyRestoreError(
  "R2_GET",
  Object.assign(new Error(SECRET), {
    name: "AccessDenied",
    $metadata: { httpStatusCode: 403 },
  }),
);

assert.equal(
  formatRestoreError(nonHead),
  "Restore verification FAILED. Stage: R2_GET, Code: ACCESS_DENIED",
);

console.log("B-2d-3 safe diagnostics mock tests PASS.");
