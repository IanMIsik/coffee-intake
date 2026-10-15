-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "pricePerKg" DECIMAL(10,2),
ADD COLUMN     "settledKg" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pricePerKg" DECIMAL(10,2),
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "recordedByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedByStaffId" TEXT,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Settlement_organizationId_farmerId_idx" ON "Settlement"("organizationId", "farmerId");

-- CreateIndex
CREATE INDEX "Settlement_receiptId_idx" ON "Settlement"("receiptId");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_recordedByStaffId_fkey" FOREIGN KEY ("recordedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_voidedByStaffId_fkey" FOREIGN KEY ("voidedByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: deliveries already marked settled become one full payment with no amount
-- (no price was recorded then), so every receipt's settledKg matches its payments.
UPDATE "Receipt" SET "settledKg" = "weightKg" WHERE "settled" = true;

INSERT INTO "Settlement" ("id", "organizationId", "receiptId", "farmerId", "weightKg", "recordedByStaffId", "createdAt")
SELECT gen_random_uuid()::text, r."organizationId", r."id", r."farmerId", r."weightKg",
       COALESCE(r."settledByStaffId", r."recordedByStaffId"), COALESCE(r."settledAt", r."createdAt")
FROM "Receipt" r
WHERE r."settled" = true;
