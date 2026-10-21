-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Fight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "fighter1Id" INTEGER NOT NULL,
    "fighter2Id" INTEGER,
    "fightOrder" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "CancelReason" TEXT,
    "winnerId" INTEGER,
    "method" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fight_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Fight_fighter1Id_fkey" FOREIGN KEY ("fighter1Id") REFERENCES "Fighter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Fight_fighter2Id_fkey" FOREIGN KEY ("fighter2Id") REFERENCES "Fighter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fight_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Fighter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Fight" ("CancelReason", "createdAt", "eventId", "fightOrder", "fighter1Id", "fighter2Id", "id", "method", "status", "winnerId") SELECT "CancelReason", "createdAt", "eventId", "fightOrder", "fighter1Id", "fighter2Id", "id", "method", "status", "winnerId" FROM "Fight";
DROP TABLE "Fight";
ALTER TABLE "new_Fight" RENAME TO "Fight";
CREATE UNIQUE INDEX "Fight_eventId_fightOrder_key" ON "Fight"("eventId", "fightOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
