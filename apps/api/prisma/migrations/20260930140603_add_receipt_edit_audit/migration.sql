-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedByStaffId" TEXT;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_editedByStaffId_fkey" FOREIGN KEY ("editedByStaffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
