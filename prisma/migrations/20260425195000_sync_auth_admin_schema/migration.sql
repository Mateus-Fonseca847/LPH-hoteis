-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('super_admin', 'hotel_admin', 'user');

-- CreateEnum
CREATE TYPE "HotelRole" AS ENUM ('owner', 'admin', 'editor');

-- Rename columns to preserve existing Hotel data
ALTER TABLE "Hotel" RENAME COLUMN "heroImage" TO "coverImageUrl";
ALTER TABLE "Hotel" RENAME COLUMN "checkIn" TO "checkInTime";
ALTER TABLE "Hotel" RENAME COLUMN "checkOut" TO "checkOutTime";
ALTER TABLE "Hotel" RENAME COLUMN "published" TO "isPublished";

-- Extend Hotel with current schema fields
ALTER TABLE "Hotel"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "whatsapp" TEXT,
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);

-- Backfill contact columns from legacy HotelContact rows
UPDATE "Hotel" h
SET "phone" = c."value"
FROM "HotelContact" c
WHERE c."hotelId" = h."id"
  AND c."type" = 'PHONE'
  AND h."phone" IS NULL;

UPDATE "Hotel" h
SET "email" = c."value"
FROM "HotelContact" c
WHERE c."hotelId" = h."id"
  AND c."type" = 'EMAIL'
  AND h."email" IS NULL;

UPDATE "Hotel" h
SET "whatsapp" = c."value"
FROM "HotelContact" c
WHERE c."hotelId" = h."id"
  AND c."type" = 'WHATSAPP'
  AND h."whatsapp" IS NULL;

ALTER TABLE "Hotel"
  ALTER COLUMN "coverImageUrl" SET NOT NULL,
  ALTER COLUMN "checkInTime" SET NOT NULL,
  ALTER COLUMN "checkOutTime" SET NOT NULL,
  ALTER COLUMN "isPublished" SET DEFAULT true,
  ALTER COLUMN "phone" SET NOT NULL,
  ALTER COLUMN "email" SET NOT NULL,
  ALTER COLUMN "whatsapp" SET NOT NULL;

-- Remove legacy column superseded by the current schema
ALTER TABLE "Hotel" DROP COLUMN "heroImageAlt";

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "globalRole" "GlobalRole" NOT NULL DEFAULT 'user',
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecret" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "role" "HotelRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HotelPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changedFields" JSONB,
  "previousValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HotelAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hotel_slug_idx" ON "Hotel"("slug");

-- CreateIndex
CREATE INDEX "Hotel_city_idx" ON "Hotel"("city");

-- CreateIndex
CREATE INDEX "Hotel_state_idx" ON "Hotel"("state");

-- Replace renamed published index with schema-aligned name
DROP INDEX IF EXISTS "Hotel_published_idx";
CREATE INDEX "Hotel_isPublished_idx" ON "Hotel"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_globalRole_idx" ON "User"("globalRole");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HotelPermission_userId_hotelId_key" ON "HotelPermission"("userId", "hotelId");

-- CreateIndex
CREATE INDEX "HotelPermission_userId_idx" ON "HotelPermission"("userId");

-- CreateIndex
CREATE INDEX "HotelPermission_hotelId_idx" ON "HotelPermission"("hotelId");

-- CreateIndex
CREATE INDEX "HotelPermission_hotelId_role_idx" ON "HotelPermission"("hotelId", "role");

-- CreateIndex
CREATE INDEX "HotelAuditLog_userId_idx" ON "HotelAuditLog"("userId");

-- CreateIndex
CREATE INDEX "HotelAuditLog_hotelId_idx" ON "HotelAuditLog"("hotelId");

-- CreateIndex
CREATE INDEX "HotelAuditLog_createdAt_idx" ON "HotelAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "HotelAuditLog_hotelId_createdAt_idx" ON "HotelAuditLog"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelAuditLog_userId_createdAt_idx" ON "HotelAuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "HotelPermission"
  ADD CONSTRAINT "HotelPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelPermission"
  ADD CONSTRAINT "HotelPermission_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelAuditLog"
  ADD CONSTRAINT "HotelAuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelAuditLog"
  ADD CONSTRAINT "HotelAuditLog_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove legacy contact storage after migrating values to Hotel columns
DROP TABLE "HotelContact";

-- Drop legacy enum no longer referenced by the schema
DROP TYPE "ContactType";
