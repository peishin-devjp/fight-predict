import assert from "node:assert/strict";
import { formatRestoreError } from "../src/backup/restoreErrorOutput";
import { RestoreDiagnosticError } from "../src/backup/restoreDiagnostics";

function main(): void {
  const diagnosticError = new RestoreDiagnosticError(
    "R2_GET",
    "ACCESS_DENIED",
  );

  assert.equal(
    formatRestoreError(diagnosticError),
    "Restore verification FAILED. Stage: R2_GET, Code: ACCESS_DENIED",
  );

  const rawError = new Error("SENSITIVE_SECRET_VALUE");

  assert.equal(
    formatRestoreError(rawError),
    "Restore verification FAILED. Unknown error.",
  );

  assert.equal(
    formatRestoreError(rawError).includes("SENSITIVE_SECRET_VALUE"),
    false,
  );

  assert.equal(
    formatRestoreError("SENSITIVE_STRING_ERROR"),
    "Restore verification FAILED. Unknown error.",
  );

  console.log("B-2d-3 restore error formatter test PASS.");
}

try {
  main();
} catch {
  console.error("B-2d-3 restore error formatter test FAILED.");
  process.exitCode = 1;
}
