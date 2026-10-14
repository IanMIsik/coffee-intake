-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "receiptSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "settled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledByStaffId" TEXT;

-- CreateIndex
CREATE INDEX "Receipt_organizationId_settled_idx" ON "Receipt"("organizationId", "settled");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_settledByStaffId_fkey" FOREIGN KEY ("settledByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
