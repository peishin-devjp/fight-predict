export type BackupConfig = {
  databasePath: string;
  r2Endpoint: string;
  r2Region: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Prefix: string;
  healthchecksPingUrl?: string | undefined;
};

export type BackupConfigResult =
  | {
      enabled: true;
      config: BackupConfig;
    }
  | {
      enabled: false;
      reason: string;
      configurationError: boolean;
    };

const REQUIRED_ENV_VARS = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

export function getBackupConfig(): BackupConfigResult {
  const backupEnabled = process.env.BACKUP_ENABLED?.trim().toLowerCase();

  if (backupEnabled === undefined || backupEnabled === "" || backupEnabled === "false") {
    return {
      enabled: false,
      reason: "Backup is intentionally disabled because BACKUP_ENABLED is not true.",
      configurationError: false,
    };
  }

  if (backupEnabled !== "true") {
    return {
      enabled: false,
      reason: `Backup configuration error: BACKUP_ENABLED must be "true" or "false", but received "${backupEnabled}".`,
      configurationError: true,
    };
  }

  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    return {
      enabled: false,
      reason: `Backup configuration error: BACKUP_ENABLED is true but required configuration is missing: ${missing.join(
        ", ",
      )}`,
      configurationError: true,
    };
  }

  return {
    enabled: true,
    config: {
      databasePath:
        process.env.BACKUP_DATABASE_PATH?.trim() ||
        "/data/fight-predict.sqlite",
      r2Endpoint: process.env.R2_ENDPOINT!.trim(),
      r2Region: process.env.R2_REGION?.trim() || "auto",
      r2Bucket: process.env.R2_BUCKET!.trim(),
      r2AccessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      r2Prefix:
        process.env.R2_BACKUP_PREFIX?.trim().replace(/^\/+|\/+$/g, "") ||
        "production/daily",
      healthchecksPingUrl:
        process.env.HEALTHCHECKS_PING_URL?.trim() || undefined,
    },
  };
}