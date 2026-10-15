-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "heldFarmerIds" TEXT[],
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Batch_organizationId_createdAt_idx" ON "Batch"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Receipt_batchId_idx" ON "Receipt"("batchId");

-- CreateIndex
CREATE INDEX "Settlement_batchId_idx" ON "Settlement"("batchId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
