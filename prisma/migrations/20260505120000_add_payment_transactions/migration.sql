-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "paymentMethod" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "grossAmountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "hotelNetAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_reservationId_key" ON "PaymentTransaction"("reservationId");
CREATE INDEX "PaymentTransaction_hotelId_idx" ON "PaymentTransaction"("hotelId");
CREATE INDEX "PaymentTransaction_provider_idx" ON "PaymentTransaction"("provider");
CREATE INDEX "PaymentTransaction_paymentMethod_idx" ON "PaymentTransaction"("paymentMethod");
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
CREATE INDEX "PaymentTransaction_paidAt_idx" ON "PaymentTransaction"("paidAt");
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");
CREATE INDEX "PaymentTransaction_hotelId_paidAt_idx" ON "PaymentTransaction"("hotelId", "paidAt");
CREATE INDEX "PaymentTransaction_hotelId_status_paidAt_idx" ON "PaymentTransaction"("hotelId", "status", "paidAt");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing paid reservations into financial transactions.
INSERT INTO "PaymentTransaction" (
    "id",
    "reservationId",
    "hotelId",
    "provider",
    "paymentMethod",
    "status",
    "grossAmountCents",
    "platformFeeCents",
    "hotelNetAmountCents",
    "currency",
    "paidAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'payment_' || "id",
    "id",
    "hotelId",
    COALESCE("paymentProvider", 'manual'::"PaymentProvider"),
    "paymentMethod",
    "paymentStatus",
    "totalPriceCents",
    ("totalPriceCents" * 1000) / 10000,
    "totalPriceCents" - (("totalPriceCents" * 1000) / 10000),
    "currency",
    "paidAt",
    COALESCE("paidAt", "createdAt"),
    CURRENT_TIMESTAMP
FROM "Reservation"
WHERE "paymentStatus" = 'paid';
