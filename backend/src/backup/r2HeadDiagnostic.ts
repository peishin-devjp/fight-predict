import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getBackupConfig, type BackupConfig } from "./config";
import { createR2Client, type R2Client } from "./r2";
import {
  classifyRestoreError,
  type RestoreDiagnosticError,
} from "./restoreDiagnostics";

export const DIAGNOSTIC_BUCKET = "fight-predict-backups";
export const DIAGNOSTIC_KEY =
  "production/daily/2026/11/12/fight-predict-20261112T030530Z.sqlite";

export class HeadDiagnosticConfigError extends Error {
  constructor() {
    super("Single HEAD diagnostic configuration rejected.");
    this.name = "HeadDiagnosticConfigError";
  }
}

function validateEnvironment(): BackupConfig {
  if (
    process.env.DATABASE_URL !== undefined ||
    process.env.BACKUP_DATABASE_PATH !== undefined ||
    process.env.HEALTHCHECKS_PING_URL !== undefined
  ) {
    throw new HeadDiagnosticConfigError();
  }

  if (process.env.BACKUP_ENABLED !== "true") {
    throw new HeadDiagnosticConfigError();
  }

  const result = getBackupConfig();

  if (!result.enabled) {
    throw new HeadDiagnosticConfigError();
  }

  const config = result.config;

  if (config.r2Bucket !== DIAGNOSTIC_BUCKET) {
    throw new HeadDiagnosticConfigError();
  }

  if (config.r2Region !== "auto") {
    throw new HeadDiagnosticConfigError();
  }

  let endpoint: URL;

  try {
    endpoint = new URL(config.r2Endpoint);
  } catch {
    throw new HeadDiagnosticConfigError();
  }

  if (
    endpoint.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(
      endpoint.hostname,
    ) ||
    endpoint.username !== "" ||
    endpoint.password !== "" ||
    endpoint.port !== "" ||
    (endpoint.pathname !== "/" && endpoint.pathname !== "") ||
    endpoint.search !== "" ||
    endpoint.hash !== ""
  ) {
    throw new HeadDiagnosticConfigError();
  }

  return config;
}

export async function runSingleHeadDiagnostic(
  clientFactory: (
    config: BackupConfig,
    options: { maxAttempts: number },
  ) => R2Client = createR2Client,
): Promise<void> {
  const config = validateEnvironment();

  const client = clientFactory(config, { maxAttempts: 1 });

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: DIAGNOSTIC_BUCKET,
        Key: DIAGNOSTIC_KEY,
      }),
    );
  } catch (error: unknown) {
    throw classifyRestoreError("R2_HEAD", error, "HEAD_1");
  }
}
