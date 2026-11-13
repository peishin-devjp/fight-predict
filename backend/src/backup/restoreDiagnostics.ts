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

export type RestoreHeadLocation =
  | "HEAD_1"
  | "HEAD_2"
  | "HEAD_3";

export type SafeSdkErrorName =
  | "AccessDenied"
  | "InvalidAccessKeyId"
  | "SignatureDoesNotMatch"
  | "NoSuchKey"
  | "NotFound"
  | "UNKNOWN";

const SAFE_SDK_ERROR_NAMES = new Set<string>([
  "AccessDenied",
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
  "NoSuchKey",
  "NotFound",
]);

export class RestoreDiagnosticError extends Error {
  constructor(
    public readonly stage: RestoreStage,
    public readonly code: RestoreErrorCode,
    public readonly headLocation?: RestoreHeadLocation,
    public readonly httpStatus?: number,
    public readonly sdkErrorName: SafeSdkErrorName = "UNKNOWN",
  ) {
    super("Restore verification failed.");
    this.name = "RestoreDiagnosticError";
  }
}

export function classifyRestoreError(
  stage: RestoreStage,
  error: unknown,
  headLocation?: RestoreHeadLocation,
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
  const rawHttpStatus =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)["httpStatusCode"]
      : undefined;

  const httpStatus =
    typeof rawHttpStatus === "number" &&
    Number.isInteger(rawHttpStatus) &&
    rawHttpStatus >= 100 &&
    rawHttpStatus <= 599
      ? rawHttpStatus
      : undefined;

  const sdkErrorName: SafeSdkErrorName =
    typeof name === "string" &&
    SAFE_SDK_ERROR_NAMES.has(name)
      ? name as SafeSdkErrorName
      : "UNKNOWN";

  let code: RestoreErrorCode = "UNKNOWN_ERROR";

  if (
    name === "InvalidAccessKeyId" ||
    name === "SignatureDoesNotMatch" ||
    name === "UnrecognizedClientException" ||
    rawHttpStatus === 401
  ) {
    code = "AUTH_ERROR";
  } else if (
    name === "AccessDenied" ||
    rawHttpStatus === 403
  ) {
    code = "ACCESS_DENIED";
  } else if (
    name === "NoSuchKey" ||
    name === "NotFound" ||
    rawHttpStatus === 404
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

  return new RestoreDiagnosticError(
    stage,
    code,
    headLocation,
    httpStatus,
    sdkErrorName,
  );
}
