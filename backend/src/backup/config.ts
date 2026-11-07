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
    };

const REQUIRED_ENV_VARS = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

export function getBackupConfig(): BackupConfigResult {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    return {
      enabled: false,
      reason: `Backup is disabled because required configuration is missing: ${missing.join(
        ", ",
      )}`,
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