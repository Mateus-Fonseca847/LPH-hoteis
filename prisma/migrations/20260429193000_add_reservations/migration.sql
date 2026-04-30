-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('pending', 'awaiting_payment', 'paid', 'payment_failed', 'cancelled');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestDocument" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "nights" INTEGER NOT NULL,
    "nightlyPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "ReservationStatus" NOT NULL DEFAULT 'pending',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_stripeCheckoutSessionId_key" ON "Reservation"("stripeCheckoutSessionId");
CREATE INDEX "Reservation_hotelId_idx" ON "Reservation"("hotelId");
CREATE INDEX "Reservation_roomId_idx" ON "Reservation"("roomId");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");
CREATE INDEX "Reservation_hotelId_createdAt_idx" ON "Reservation"("hotelId", "createdAt");
CREATE INDEX "Reservation_guestEmail_idx" ON "Reservation"("guestEmail");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
