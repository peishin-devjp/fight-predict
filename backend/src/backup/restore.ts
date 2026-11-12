import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { BackupConfig } from "./config";
import type { R2Client } from "./r2";
import { classifyRestoreError } from "./restoreDiagnostics";

const REQUIRED_TABLES = [
  "User",
  "Event",
  "Fighter",
  "Fight",
  "Prediction",
  "Session",
  "EmailVerificationToken",
  "PasswordResetToken",
  "_prisma_migrations",
] as const;

export type RestoreValidationResult = {
  filePath: string;
  size: number;
  sha256: string;
  migrations: string[];
};

export type DownloadedBackup = {
  filePath: string;
  key: string;
  size: number;
  sha256: string;
};

export async function downloadBackupForValidation(
  client: R2Client,
  config: BackupConfig,
  key: string,
  outputPath: string,
): Promise<DownloadedBackup> {
  let head;
  try {
    head = await client.send(
      new HeadObjectCommand({
        Bucket: config.r2Bucket,
        Key: key,
      }),
    );
  } catch (error: unknown) {
    throw classifyRestoreError("R2_HEAD", error);
  }

  const expectedSize = head.ContentLength;
  const expectedSha256 = head.Metadata?.sha256;

  if (
    typeof expectedSize !== "number" ||
    expectedSize <= 0
  ) {
    throw new Error(
      `R2 backup object has invalid size metadata: ${key}`,
    );
  }

  if (
    typeof expectedSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedSha256)
  ) {
    throw new Error(
      `R2 backup object has invalid SHA-256 metadata: ${key}`,
    );
  }

  let response;
  try {
    response = await client.send(
      new GetObjectCommand({
        Bucket: config.r2Bucket,
        Key: key,
      }),
    );
  } catch (error: unknown) {
    throw classifyRestoreError("R2_GET", error);
  }

  if (!response.Body) {
    throw new Error(
      `R2 backup object returned an empty body: ${key}`,
    );
  }

  const resolvedOutputPath = path.resolve(outputPath);

  try {
    await pipeline(
      response.Body as NodeJS.ReadableStream,
      createWriteStream(resolvedOutputPath, {
        flags: "wx",
      }),
    );
  } catch (error: unknown) {
    throw classifyRestoreError("DOWNLOAD", error);
  }

  return {
    filePath: resolvedOutputPath,
    key,
    size: expectedSize,
    sha256: expectedSha256,
  };
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function getCodeMigrationNames(
  migrationsDirectory: string,
): Promise<string[]> {
  const entries = await readdir(migrationsDirectory, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function validateDownloadedBackup(
  filePath: string,
  expectedSha256: string,
  expectedSize: number,
  migrationsDirectory: string,
): Promise<RestoreValidationResult> {
  const resolvedPath = path.resolve(filePath);
  const fileStat = await stat(resolvedPath);

  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new Error("Downloaded backup is empty or is not a file.");
  }

  if (fileStat.size !== expectedSize) {
    throw new Error("Downloaded backup size does not match R2 metadata.");
  }

  const actualSha256 = await calculateSha256(resolvedPath);

  if (actualSha256 !== expectedSha256) {
    throw new Error(
      "Downloaded backup SHA-256 does not match R2 metadata.",
    );
  }

  // Validate SQLite using a working copy, never the downloaded original.
  const workingPath = path.join(
    path.dirname(resolvedPath),
    `restore-working-${process.pid}-${Date.now()}.sqlite`,
  );

  await copyFile(resolvedPath, workingPath);

  let prisma: PrismaClient;

  try {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${workingPath}`,
        },
      },
    });
  } catch (error) {
    await rm(workingPath, { force: true });
    throw error;
  }

  try {
    const integrity = await prisma.$queryRawUnsafe<
      Array<{ integrity_check: string }>
    >("PRAGMA integrity_check;");

    if (
      integrity.length !== 1 ||
      integrity[0]?.integrity_check.toLowerCase() !== "ok"
    ) {
      throw new Error(
        "Downloaded backup failed SQLite integrity_check.",
      );
    }

    const tables = await prisma.$queryRawUnsafe<
      Array<{ name: string }>
    >(
      "SELECT name FROM sqlite_master WHERE type = 'table';",
    );

    const tableNames = new Set(tables.map((table) => table.name));

    for (const requiredTable of REQUIRED_TABLES) {
      if (!tableNames.has(requiredTable)) {
        throw new Error(
          `Downloaded backup is missing required table: ${requiredTable}`,
        );
      }
    }

    const appliedMigrations = await prisma.$queryRawUnsafe<
      Array<{ migration_name: string; finished_at: string | null }>
    >(
      `SELECT migration_name, finished_at
       FROM "_prisma_migrations"
       ORDER BY migration_name;`,
    );

    const incompleteMigration = appliedMigrations.find(
      (migration) => migration.finished_at === null,
    );

    if (incompleteMigration) {
      throw new Error(
        `Downloaded backup contains incomplete migration: ${incompleteMigration.migration_name}`,
      );
    }

    const appliedMigrationNames = appliedMigrations
      .map((migration) => migration.migration_name)
      .sort();

    const codeMigrationNames =
      await getCodeMigrationNames(migrationsDirectory);

    const missingFromBackup = codeMigrationNames.filter(
      (migration) => !appliedMigrationNames.includes(migration),
    );

    const unknownInBackup = appliedMigrationNames.filter(
      (migration) => !codeMigrationNames.includes(migration),
    );

    if (
      missingFromBackup.length > 0 ||
      unknownInBackup.length > 0
    ) {
      throw new Error(
        [
          "Downloaded backup migration state does not match code.",
          missingFromBackup.length > 0
            ? `Missing from backup: ${missingFromBackup.join(", ")}`
            : undefined,
          unknownInBackup.length > 0
            ? `Unknown in backup: ${unknownInBackup.join(", ")}`
            : undefined,
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    return {
      filePath: resolvedPath,
      size: fileStat.size,
      sha256: actualSha256,
      migrations: appliedMigrationNames,
    };
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await rm(workingPath, { force: true });
    }
  }
}