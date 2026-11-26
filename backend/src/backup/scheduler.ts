import type { BackupConfig } from "./config";
import { runBackup } from "./backup";
import {
  createR2Client,
  hasVerifiedBackupForUtcDate,
  type R2Client,
} from "./r2";

const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;
const BACKUP_TARGET_HOUR_UTC = 3;

type SchedulerDependencies = {
  r2Client?: R2Client;
  now?: () => Date;
  runBackupFn?: typeof runBackup;
};

export type BackupScheduler = {
  initialCheck: Promise<void>;
  stop: () => void;
};

function isAfterDailyTarget(date: Date): boolean {
  return date.getUTCHours() >= BACKUP_TARGET_HOUR_UTC;
}

export function startBackupScheduler(
  config: BackupConfig,
  dependencies: SchedulerDependencies = {},
): BackupScheduler {
  const client = dependencies.r2Client ?? createR2Client(config);
  const now = dependencies.now ?? (() => new Date());
  const runBackupFn = dependencies.runBackupFn ?? runBackup;

  let running = false;
  let stopped = false;

  const check = async (): Promise<void> => {
    if (stopped || running) {
      return;
    }

    const currentTime = now();

    if (!isAfterDailyTarget(currentTime)) {
      return;
    }

    running = true;

    try {
      const alreadyBackedUp = await hasVerifiedBackupForUtcDate(
        client,
        config,
        currentTime,
      );

      if (alreadyBackedUp) {
        return;
      }

      await runBackupFn(config, {
        r2Client: client,
      });

      console.log("Daily SQLite backup completed successfully.");
    } catch (error) {
      console.error(
        "Daily SQLite backup attempt failed.",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => {
    void check();
  }, SCHEDULER_INTERVAL_MS);

  interval.unref();

  const initialCheck = check();

  return {
    initialCheck,
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}