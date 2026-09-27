/*
  Warnings:

  - A unique constraint covering the columns `[eventId,fightOrder]` on the table `Fight` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Fight" ADD COLUMN "fightOrder" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Fight_eventId_fightOrder_key" ON "Fight"("eventId", "fightOrder");
