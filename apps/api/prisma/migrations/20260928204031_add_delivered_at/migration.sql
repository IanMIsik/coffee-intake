/*
  Warnings:

  - Added the required column `deliveredAt` to the `Receipt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "deliveredAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Receipt_organizationId_deliveredAt_idx" ON "Receipt"("organizationId", "deliveredAt");
