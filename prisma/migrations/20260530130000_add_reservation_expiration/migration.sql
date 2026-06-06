ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE "Reservation"
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "expiredAt" TIMESTAMP(3);

CREATE INDEX "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");
CREATE INDEX "Reservation_expiredAt_idx" ON "Reservation"("expiredAt");
CREATE INDEX "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");
