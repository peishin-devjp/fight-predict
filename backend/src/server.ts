import type { Server } from "node:http";
import app from "./app";
import prisma from "./lib/prisma";
import { getPort, verifyStartup } from "./startup";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
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