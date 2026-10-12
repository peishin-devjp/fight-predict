-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Prediction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "fightId" INTEGER NOT NULL,
    "predictedWinnerId" INTEGER NOT NULL,
    "point" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Prediction_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "Fight" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Prediction" ("createdAt", "fightId", "id", "point", "predictedWinnerId", "userId") SELECT "createdAt", "fightId", "id", "point", "predictedWinnerId", "userId" FROM "Prediction";
DROP TABLE "Prediction";
ALTER TABLE "new_Prediction" RENAME TO "Prediction";
CREATE UNIQUE INDEX "Prediction_userId_fightId_key" ON "Prediction"("userId", "fightId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
