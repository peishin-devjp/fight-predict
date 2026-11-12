export type RestoreStage =
  | "CONFIG"
  | "R2_HEAD"
  | "R2_GET"
  | "DOWNLOAD"
  | "SIZE_CHECK"
  | "SHA256_CHECK"
  | "SQLITE_INTEGRITY"
  | "TABLE_CHECK"
  | "MIGRATION_CHECK"
  | "CLEANUP";

export type RestoreErrorCode =
  | "AUTH_ERROR"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export class RestoreDiagnosticError extends Error {
  constructor(
    public readonly stage: RestoreStage,
    public readonly code: RestoreErrorCode,
  ) {
    super("Restore verification failed.");
    this.name = "RestoreDiagnosticError";
  }
}

export function classifyRestoreError(
  stage: RestoreStage,
  error: unknown,
): RestoreDiagnosticError {
  if (error instanceof RestoreDiagnosticError) {
    return error;
  }

  const source =
    typeof error === "object" && error !== null
      ? error as Record<string, unknown>
      : {};

  const name =
    error instanceof Error ? error.name : undefined;

  const networkCode = source["code"];

  const metadata = source["$metadata"];
  const httpStatus =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)["httpStatusCode"]
      : undefined;

  let code: RestoreErrorCode = "UNKNOWN_ERROR";

  if (
    name === "InvalidAccessKeyId" ||
    name === "SignatureDoesNotMatch" ||
    name === "UnrecognizedClientException" ||
    httpStatus === 401
  ) {
    code = "AUTH_ERROR";
  } else if (
    name === "AccessDenied" ||
    httpStatus === 403
  ) {
    code = "ACCESS_DENIED";
  } else if (
    name === "NoSuchKey" ||
    name === "NotFound" ||
    httpStatus === 404
  ) {
    code = "NOT_FOUND";
  } else if (
    name === "TimeoutError" ||
    name === "NetworkingError" ||
    name === "AbortError" ||
    networkCode === "ECONNRESET" ||
    networkCode === "ETIMEDOUT" ||
    networkCode === "ENOTFOUND" ||
    networkCode === "ECONNREFUSED"
  ) {
    code = "NETWORK_ERROR";
  }

  return new RestoreDiagnosticError(stage, code);
}
