-- AlterTable
ALTER TABLE "seat" ADD COLUMN     "lastUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "setting" ADD COLUMN     "unusedSeatDays" INTEGER NOT NULL DEFAULT 30;
