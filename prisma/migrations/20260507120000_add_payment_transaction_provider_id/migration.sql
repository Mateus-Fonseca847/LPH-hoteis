-- Track the provider payment identifier on financial transactions for webhook lookup.
ALTER TABLE "PaymentTransaction" ADD COLUMN "providerPaymentId" TEXT;

CREATE UNIQUE INDEX "PaymentTransaction_providerPaymentId_key" ON "PaymentTransaction"("providerPaymentId");
CREATE INDEX "PaymentTransaction_providerPaymentId_idx" ON "PaymentTransaction"("providerPaymentId");
