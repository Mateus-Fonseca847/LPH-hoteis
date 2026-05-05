-- Adds explicit flags so development/staging financial demo records can be
-- identified and removed without touching real reservations or payments.
ALTER TABLE "Reservation" ADD COLUMN "isTestData" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentTransaction" ADD COLUMN "isTestData" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Reservation_isTestData_idx" ON "Reservation"("isTestData");

CREATE INDEX "PaymentTransaction_isTestData_idx" ON "PaymentTransaction"("isTestData");
