/*
  Warnings:

  - A unique constraint covering the columns `[userId,fightId]` on the table `Prediction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Prediction_userId_fightId_key" ON "Prediction"("userId", "fightId");
