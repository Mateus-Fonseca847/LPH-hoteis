-- Migration applied previously from the clean local copy.
-- Kept here so the local migration directory matches the database history.
CREATE TABLE "HotelPaymentSettings" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicKey" TEXT,
    "accessTokenEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelPaymentSettings_hotelId_key" ON "HotelPaymentSettings"("hotelId");
CREATE INDEX "HotelPaymentSettings_provider_idx" ON "HotelPaymentSettings"("provider");
CREATE INDEX "HotelPaymentSettings_isEnabled_idx" ON "HotelPaymentSettings"("isEnabled");

ALTER TABLE "HotelPaymentSettings" ADD CONSTRAINT "HotelPaymentSettings_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
