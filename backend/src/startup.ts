import fs from "node:fs/promises";
import path from "node:path";
import prisma from "./lib/prisma";

const PRODUCTION_DATABASE_URL = "file:/data/fight-predict.sqlite";

const REQUIRED_TABLES = [
  "_prisma_migrations",
  "User",
  "Event",
  "Fight",
  "Fighter",
  "Session",
  "EmailVerificationToken",
  "PasswordResetToken",
  "Prediction",
] as const;

type TableRow = {
  name: string;
};

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export function getPort(): number {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PORT is required in production.");
    }

    return 3001;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const frontendOrigin = process.env.FRONTEND_ORIGIN;

  if (!frontendOrigin) {
    throw new Error("FRONTEND_ORIGIN is required in production.");
  }

  let parsedFrontendOrigin: URL;

  try {
    parsedFrontendOrigin = new URL(frontendOrigin);
  } catch {
    throw new Error("FRONTEND_ORIGIN must be a valid URL.");
  }

  if (parsedFrontendOrigin.protocol !== "https:") {
    throw new Error("FRONTEND_ORIGIN must use HTTPS in production.");
  }

  if (
    parsedFrontendOrigin.hostname === "localhost" ||
    parsedFrontendOrigin.hostname === "127.0.0.1"
  ) {
    throw new Error("FRONTEND_ORIGIN must not point to localhost in production.");
  }

  if (process.env.DATABASE_URL !== PRODUCTION_DATABASE_URL) {
    throw new Error(
      `DATABASE_URL must be ${PRODUCTION_DATABASE_URL} in production.`,
    );
  }
}

async function verifyProductionDatabaseFile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const databasePath = "/data/fight-predict.sqlite";

  let stats;

  try {
    stats = await fs.stat(databasePath);
  } catch {
    throw new Error(
      `Production database file does not exist: ${databasePath}. ` +
        "Startup will not create it automatically.",
    );
  }

  if (!stats.isFile()) {
    throw new Error(`Production database path is not a file: ${databasePath}.`);
  }
}

async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error("Database connection check failed.");
  }
}

async function verifyRequiredTables(): Promise<void> {
  const rows = await prisma.$queryRaw<TableRow[]>`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `;

  const existingTables = new Set(rows.map((row) => row.name));

  const missingTables = REQUIRED_TABLES.filter(
    (table) => !existingTables.has(table),
  );

  if (missingTables.length > 0) {
    throw new Error(
      `Database is missing required tables: ${missingTables.join(", ")}.`,
    );
  }
}

async function verifyMigrations(): Promise<void> {
  const migrationsDirectory = path.resolve(process.cwd(), "prisma", "migrations");

  let directoryEntries;

  try {
    directoryEntries = await fs.readdir(migrationsDirectory, {
      withFileTypes: true,
    });
  } catch {
    throw new Error(
      `Prisma migrations directory is not available: ${migrationsDirectory}.`,
    );
  }

  const expectedMigrations = directoryEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (expectedMigrations.length === 0) {
    throw new Error("No Prisma migration directories were found.");
  }

  const appliedRows = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
  `;

  const incompleteMigrations = appliedRows.filter(
    (row) => row.finished_at === null && row.rolled_back_at === null,
  );

  if (incompleteMigrations.length > 0) {
    throw new Error(
      `Database contains incomplete migrations: ${incompleteMigrations
        .map((row) => row.migration_name)
        .join(", ")}.`,
    );
  }

  const appliedMigrations = new Set(
    appliedRows
      .filter(
        (row) => row.finished_at !== null && row.rolled_back_at === null,
      )
      .map((row) => row.migration_name),
  );

  const missingMigrations = expectedMigrations.filter(
    (migration) => !appliedMigrations.has(migration),
  );

  if (missingMigrations.length > 0) {
    throw new Error(
      `Database is missing required migrations: ${missingMigrations.join(", ")}.`,
    );
  }

  const expectedMigrationSet = new Set(expectedMigrations);

  const unknownMigrations = [...appliedMigrations].filter(
    (migration) => !expectedMigrationSet.has(migration),
  );

  if (unknownMigrations.length > 0) {
    throw new Error(
      `Database contains migrations unknown to this code version: ${unknownMigrations.join(", ")}.`,
    );
  }
}

export async function verifyStartup(): Promise<void> {
  validateProductionEnvironment();
  await verifyProductionDatabaseFile();
  await verifyDatabaseConnection();
  await verifyRequiredTables();
  await verifyMigrations();
}