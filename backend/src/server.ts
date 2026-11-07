import type { Server } from "node:http";
import app from "./app";
import prisma from "./lib/prisma";
import { getPort, verifyStartup } from "./startup";
import { getBackupConfig } from "./backup/config";
import {
  startBackupScheduler,
  type BackupScheduler,
} from "./backup/scheduler";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let backupScheduler: BackupScheduler | undefined;
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Received ${signal}. Starting graceful shutdown.`);

  const forceShutdownTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceShutdownTimer.unref();

  try {
    backupScheduler?.stop();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await prisma.$disconnect();
    console.log("Graceful shutdown completed.");
    process.exitCode = 0;
  } catch {
    console.error("Graceful shutdown failed.");
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const port = getPort();

  await verifyStartup();

  server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server is listening on port ${port}.`);
  });

  const backupConfig = getBackupConfig();

  if (backupConfig.enabled) {
    try {
      backupScheduler = startBackupScheduler(backupConfig.config);
      console.log("Daily SQLite backup scheduler enabled.");
    } catch (error) {
      console.error(
        "Daily SQLite backup scheduler could not be initialized. Backend will continue without automatic backups.",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  } else if (backupConfig.configurationError) {
    console.error(backupConfig.reason);
  } else {
    console.log(backupConfig.reason);
  }

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

main().catch(async () => {
  console.error("Server startup failed.");

  try {
    await prisma.$disconnect();
  } catch {
    console.error("Database disconnect after startup failure failed.");
  }

  process.exitCode = 1;
});