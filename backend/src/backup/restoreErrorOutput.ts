import { RestoreDiagnosticError } from "./restoreDiagnostics";

export function formatRestoreError(error: unknown): string {
  if (error instanceof RestoreDiagnosticError) {
    const base = `Restore verification FAILED. Stage: ${error.stage}, Code: ${error.code}`;

    if (error.stage !== "R2_HEAD") {
      return base;
    }

    const head =
      error.headLocation === "HEAD_1" ||
      error.headLocation === "HEAD_2" ||
      error.headLocation === "HEAD_3"
        ? error.headLocation
        : "UNKNOWN";

    const http =
      typeof error.httpStatus === "number" &&
      Number.isInteger(error.httpStatus) &&
      error.httpStatus >= 100 &&
      error.httpStatus <= 599
        ? String(error.httpStatus)
        : "UNKNOWN";

    const sdk =
      error.sdkErrorName === "AccessDenied" ||
      error.sdkErrorName === "InvalidAccessKeyId" ||
      error.sdkErrorName === "SignatureDoesNotMatch" ||
      error.sdkErrorName === "NoSuchKey" ||
      error.sdkErrorName === "NotFound"
        ? error.sdkErrorName
        : "UNKNOWN";

    return `${base}, Head: ${head}, HTTP: ${http}, SDK: ${sdk}`;
  }

  return "Restore verification FAILED. Unknown error.";
}
