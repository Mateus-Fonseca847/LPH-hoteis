-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'awaiting_payment', 'paid', 'payment_failed', 'cancelled');

-- AlterTable
ALTER TABLE "Reservation"
ADD COLUMN "paymentProvider" "PaymentProvider",
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "providerPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_providerPaymentId_key" ON "Reservation"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Reservation_paymentProvider_idx" ON "Reservation"("paymentProvider");

-- CreateIndex
CREATE INDEX "Reservation_paymentMethod_idx" ON "Reservation"("paymentMethod");

-- CreateIndex
CREATE INDEX "Reservation_paymentStatus_idx" ON "Reservation"("paymentStatus");
