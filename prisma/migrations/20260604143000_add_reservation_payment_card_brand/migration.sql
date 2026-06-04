ALTER TABLE "Reservation" ADD COLUMN "paymentCardBrand" TEXT;

CREATE INDEX "Reservation_paymentCardBrand_idx" ON "Reservation"("paymentCardBrand");
