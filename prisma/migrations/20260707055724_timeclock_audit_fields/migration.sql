-- AlterTable
ALTER TABLE "TimeClockEntry" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedByUserId" TEXT;
