ALTER TABLE "Reservation" ADD COLUMN "availabilityHeld" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Reservation_availabilityHeld_idx" ON "Reservation"("availabilityHeld");
