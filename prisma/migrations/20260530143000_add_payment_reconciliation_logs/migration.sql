CREATE TABLE "PaymentReconciliationLog" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "hotelId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'mercado_pago',
    "source" TEXT NOT NULL,
    "paymentId" TEXT,
    "preferenceId" TEXT,
    "remoteStatus" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentReconciliationLog_reservationId_idx" ON "PaymentReconciliationLog"("reservationId");
CREATE INDEX "PaymentReconciliationLog_hotelId_idx" ON "PaymentReconciliationLog"("hotelId");
CREATE INDEX "PaymentReconciliationLog_provider_idx" ON "PaymentReconciliationLog"("provider");
CREATE INDEX "PaymentReconciliationLog_source_idx" ON "PaymentReconciliationLog"("source");
CREATE INDEX "PaymentReconciliationLog_remoteStatus_idx" ON "PaymentReconciliationLog"("remoteStatus");
CREATE INDEX "PaymentReconciliationLog_success_idx" ON "PaymentReconciliationLog"("success");
CREATE INDEX "PaymentReconciliationLog_createdAt_idx" ON "PaymentReconciliationLog"("createdAt");

ALTER TABLE "PaymentReconciliationLog" ADD CONSTRAINT "PaymentReconciliationLog_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentReconciliationLog" ADD CONSTRAINT "PaymentReconciliationLog_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
