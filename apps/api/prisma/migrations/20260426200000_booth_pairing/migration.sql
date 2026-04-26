-- AlterTable
ALTER TABLE "Booth" ADD COLUMN     "pairingCode" TEXT,
ADD COLUMN     "pairingCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pairedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booth_pairingCode_key" ON "Booth"("pairingCode");
