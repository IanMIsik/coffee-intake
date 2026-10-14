-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi';

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;
