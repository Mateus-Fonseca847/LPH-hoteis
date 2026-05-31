CREATE TABLE "ReservationOperationLog" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "previousPaymentStatus" TEXT,
    "nextPaymentStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationOperationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReservationOperationLog_reservationId_idx" ON "ReservationOperationLog"("reservationId");
CREATE INDEX "ReservationOperationLog_hotelId_idx" ON "ReservationOperationLog"("hotelId");
CREATE INDEX "ReservationOperationLog_createdById_idx" ON "ReservationOperationLog"("createdById");
CREATE INDEX "ReservationOperationLog_action_idx" ON "ReservationOperationLog"("action");
CREATE INDEX "ReservationOperationLog_createdAt_idx" ON "ReservationOperationLog"("createdAt");

ALTER TABLE "ReservationOperationLog" ADD CONSTRAINT "ReservationOperationLog_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationOperationLog" ADD CONSTRAINT "ReservationOperationLog_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationOperationLog" ADD CONSTRAINT "ReservationOperationLog_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
