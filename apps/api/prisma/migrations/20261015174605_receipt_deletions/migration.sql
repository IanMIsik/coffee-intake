-- CreateTable
CREATE TABLE "ReceiptDeletion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "farmerName" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "recordedByName" TEXT,
    "deletedByStaffId" TEXT NOT NULL,
    "deletedByName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptDeletion_organizationId_farmerId_idx" ON "ReceiptDeletion"("organizationId", "farmerId");

-- CreateIndex
CREATE INDEX "ReceiptDeletion_organizationId_createdAt_idx" ON "ReceiptDeletion"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReceiptDeletion" ADD CONSTRAINT "ReceiptDeletion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
