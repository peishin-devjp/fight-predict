-- AlterTable
ALTER TABLE "Fight" ADD COLUMN "CancelReason" TEXT;
UPDATE "Fight"
SET "cancelReason" = 'STANDARD'
WHERE "status" = 'cancelled'
  AND "cancelReason" IS NULL;