import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export type LocalBackupCandidate = {
  filePath: string;
  size: number;
  sha256: string;
  createdAt: Date;
};

function escapeSqliteString(value: string): string {
  return value.replaceAll("'", "''");
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function verifyIntegrity(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const result = await prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>(
      "PRAGMA integrity_check;",
    );

    if (
      result.length !== 1 ||
      result[0]?.integrity_check.toLowerCase() !== "ok"
    ) {
      throw new Error("SQLite backup candidate failed integrity_check.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function createLocalBackupCandidate(
  databasePath: string,
  outputPath: string,
): Promise<LocalBackupCandidate> {
  await access(databasePath);

  const resolvedDatabasePath = path.resolve(databasePath);
  const resolvedOutputPath = path.resolve(outputPath);

  if (resolvedDatabasePath === resolvedOutputPath) {
    throw new Error("Backup output path must differ from the source database.");
  }

  await rm(resolvedOutputPath, { force: true });

  const sourcePrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${resolvedDatabasePath}`,
      },
    },
  });

  try {
    const escapedOutputPath = escapeSqliteString(resolvedOutputPath);
    await sourcePrisma.$executeRawUnsafe(
      `VACUUM INTO '${escapedOutputPath}';`,
    );
  } finally {
    await sourcePrisma.$disconnect();
  }

  try {
    await access(resolvedOutputPath);

    await verifyIntegrity(`file:${resolvedOutputPath}`);

    const fileStat = await stat(resolvedOutputPath);

    if (!fileStat.isFile() || fileStat.size <= 0) {
      throw new Error("SQLite backup candidate is empty or is not a file.");
    }

    const sha256 = await calculateSha256(resolvedOutputPath);

    return {
      filePath: resolvedOutputPath,
      size: fileStat.size,
      sha256,
      createdAt: new Date(),
    };
  } catch (error) {
    await rm(resolvedOutputPath, { force: true });
    throw error;
  }
}

export async function removeLocalBackupCandidate(
  filePath: string,
): Promise<void> {
  await rm(filePath, { force: true });
}