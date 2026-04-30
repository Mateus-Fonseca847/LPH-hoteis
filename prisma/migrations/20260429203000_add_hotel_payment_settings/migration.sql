-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('manual', 'mercado_pago');

-- CreateTable
CREATE TABLE "HotelPaymentSettings" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'manual',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "receiverLabel" TEXT NOT NULL,
    "publicKey" TEXT,
    "encryptedAccessToken" TEXT,
    "pixKey" TEXT,
    "payoutDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelPaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelPaymentSettings_hotelId_key" ON "HotelPaymentSettings"("hotelId");
CREATE INDEX "HotelPaymentSettings_provider_idx" ON "HotelPaymentSettings"("provider");
CREATE INDEX "HotelPaymentSettings_isEnabled_idx" ON "HotelPaymentSettings"("isEnabled");

-- AddForeignKey
ALTER TABLE "HotelPaymentSettings" ADD CONSTRAINT "HotelPaymentSettings_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
