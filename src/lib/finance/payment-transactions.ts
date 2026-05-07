import { prisma } from "@/lib/prisma";

type InitialPaymentTransactionStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "payment_failed"
  | "cancelled";

const PLATFORM_FEE_BASIS_POINTS = 1000;
const BASIS_POINTS = 10000;

export function calculatePaymentTransactionAmounts(grossAmountCents: number) {
  if (!Number.isInteger(grossAmountCents) || grossAmountCents < 0) {
    throw new Error("Valor bruto da transacao invalido.");
  }

  const platformFeeCents = Math.floor(
    (grossAmountCents * PLATFORM_FEE_BASIS_POINTS) / BASIS_POINTS
  );

  return {
    grossAmountCents,
    platformFeeCents,
    hotelNetAmountCents: grossAmountCents - platformFeeCents,
  };
}

export async function upsertPaidPaymentTransactionForReservation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    select: {
      id: true,
      hotelId: true,
      paymentProvider: true,
      providerPaymentId: true,
      paymentMethod: true,
      paymentStatus: true,
      totalPriceCents: true,
      currency: true,
      paidAt: true,
    },
  });

  if (!reservation || reservation.paymentStatus !== "paid") {
    return null;
  }

  const amounts = calculatePaymentTransactionAmounts(reservation.totalPriceCents);
  const paidAt = reservation.paidAt ?? new Date();

  return prisma.paymentTransaction.upsert({
    where: {
      reservationId: reservation.id,
    },
    create: {
      reservationId: reservation.id,
      hotelId: reservation.hotelId,
      provider: reservation.paymentProvider ?? "manual",
      providerPaymentId: reservation.providerPaymentId,
      paymentMethod: reservation.paymentMethod,
      status: "paid",
      ...amounts,
      currency: reservation.currency,
      paidAt,
    },
    update: {
      hotelId: reservation.hotelId,
      provider: reservation.paymentProvider ?? "manual",
      providerPaymentId: reservation.providerPaymentId,
      paymentMethod: reservation.paymentMethod,
      status: "paid",
      ...amounts,
      currency: reservation.currency,
      paidAt,
    },
  });
}

export async function upsertInitialPaymentTransactionForReservation(
  reservationId: string,
  status: InitialPaymentTransactionStatus = "awaiting_payment",
  providerPaymentId?: string | null
) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    select: {
      id: true,
      hotelId: true,
      paymentProvider: true,
      providerPaymentId: true,
      paymentMethod: true,
      totalPriceCents: true,
      currency: true,
    },
  });

  if (!reservation) {
    return null;
  }

  const amounts = calculatePaymentTransactionAmounts(reservation.totalPriceCents);
  const resolvedProviderPaymentId = providerPaymentId ?? reservation.providerPaymentId;

  return prisma.paymentTransaction.upsert({
    where: {
      reservationId: reservation.id,
    },
    create: {
      reservationId: reservation.id,
      hotelId: reservation.hotelId,
      provider: reservation.paymentProvider ?? "manual",
      providerPaymentId: resolvedProviderPaymentId,
      paymentMethod: reservation.paymentMethod,
      status,
      ...amounts,
      currency: reservation.currency,
      paidAt: null,
    },
    update: {
      hotelId: reservation.hotelId,
      provider: reservation.paymentProvider ?? "manual",
      providerPaymentId: resolvedProviderPaymentId,
      paymentMethod: reservation.paymentMethod,
      status,
      ...amounts,
      currency: reservation.currency,
      paidAt: null,
    },
  });
}
