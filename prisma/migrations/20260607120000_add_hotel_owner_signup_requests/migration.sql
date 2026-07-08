CREATE TYPE "HotelOwnerSignupStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "HotelOwnerSignupRequest" (
    "id" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "hotelCity" TEXT NOT NULL,
    "hotelState" TEXT NOT NULL,
    "hotelDocument" TEXT,
    "message" TEXT,
    "status" "HotelOwnerSignupStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdUserId" TEXT,

    CONSTRAINT "HotelOwnerSignupRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HotelOwnerSignupRequest_email_idx" ON "HotelOwnerSignupRequest"("email");
CREATE INDEX "HotelOwnerSignupRequest_status_idx" ON "HotelOwnerSignupRequest"("status");
CREATE INDEX "HotelOwnerSignupRequest_createdAt_idx" ON "HotelOwnerSignupRequest"("createdAt");
CREATE INDEX "HotelOwnerSignupRequest_reviewedById_idx" ON "HotelOwnerSignupRequest"("reviewedById");
CREATE INDEX "HotelOwnerSignupRequest_createdUserId_idx" ON "HotelOwnerSignupRequest"("createdUserId");
CREATE INDEX "HotelOwnerSignupRequest_email_status_idx" ON "HotelOwnerSignupRequest"("email", "status");

ALTER TABLE "HotelOwnerSignupRequest"
ADD CONSTRAINT "HotelOwnerSignupRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HotelOwnerSignupRequest"
ADD CONSTRAINT "HotelOwnerSignupRequest_createdUserId_fkey"
FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
