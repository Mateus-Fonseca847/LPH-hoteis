import { ConflictError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { getStayDates } from "@/lib/stay-query";

const DEFAULT_PAYMENT_TTL_MINUTES = 30;
const MIN_PAYMENT_TTL_MINUTES = 1;
const MAX_PAYMENT_TTL_MINUTES = 24 * 60;

type ExpirePendingReservationsInput = {
  now?: Date;
  reservationId?: string;
  roomId?: string;
  checkIn?: Date | string;
  checkOut?: Date | string;
  limit?: number;
};

function toUtcDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : toUtcDate(value);
}

export function getBookingPaymentTtlMinutes() {
  const rawValue = process.env.BOOKING_PAYMENT_TTL_MINUTES?.trim();
  const parsedValue = rawValue ? Number(rawValue) : DEFAULT_PAYMENT_TTL_MINUTES;

  if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
    return DEFAULT_PAYMENT_TTL_MINUTES;
  }

  return Math.min(Math.max(parsedValue, MIN_PAYMENT_TTL_MINUTES), MAX_PAYMENT_TTL_MINUTES);
}

export function getBookingPaymentExpiresAt(now = new Date()) {
  return new Date(now.getTime() + getBookingPaymentTtlMinutes() * 60 * 1000);
}

export function isAwaitingPaymentExpired(
  reservation: { status?: string | null; expiresAt?: Date | null; expiredAt?: Date | null },
  now = new Date()
) {
  return (
    reservation.status === "expired" ||
    Boolean(reservation.expiredAt) ||
    Boolean(reservation.expiresAt && reservation.expiresAt <= now)
  );
}

export async function expirePendingReservations(input: ExpirePendingReservationsInput = {}) {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const overlapFilter =
    input.roomId && input.checkIn && input.checkOut
      ? {
          roomId: input.roomId,
          checkIn: {
            lt: toDate(input.checkOut),
          },
          checkOut: {
            gt: toDate(input.checkIn),
          },
        }
      : {};

  const candidates = await prisma.reservation.findMany({
    where: {
      ...(input.reservationId ? { id: input.reservationId } : {}),
      ...overlapFilter,
      status: "awaiting_payment",
      paymentStatus: "awaiting_payment",
      expiresAt: {
        lte: now,
      },
      expiredAt: null,
      availabilityHeld: true,
      paymentTransaction: {
        is: {
          status: "awaiting_payment",
        },
      },
    },
    select: {
      id: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
    },
    take: limit,
  });

  let expired = 0;

  for (const candidate of candidates) {
    // Expira reserva, libera disponibilidade e cancela a transacao financeira juntas.
    // O update condicional torna a rotina idempotente e evita corrida com webhook pago.
    const didExpire = await prisma.$transaction(async (transaction) => {
      const reservationUpdate = await transaction.reservation.updateMany({
        where: {
          id: candidate.id,
          status: "awaiting_payment",
          paymentStatus: "awaiting_payment",
          expiresAt: {
            lte: now,
          },
          expiredAt: null,
          availabilityHeld: true,
          paymentTransaction: {
            is: {
              status: "awaiting_payment",
            },
          },
        },
        data: {
          status: "expired",
          paymentStatus: "cancelled",
          expiredAt: now,
          availabilityHeld: false,
        },
      });

      if (reservationUpdate.count !== 1) {
        return false;
      }

      const availabilityDates = getStayDates(
        toDateOnly(candidate.checkIn),
        toDateOnly(candidate.checkOut)
      ).map(toUtcDate);

      const availabilityUpdate = await transaction.roomAvailability.updateMany({
        where: {
          roomId: candidate.roomId,
          date: {
            in: availabilityDates,
          },
        },
        data: {
          availableUnits: {
            increment: 1,
          },
        },
      });

      if (availabilityUpdate.count !== availabilityDates.length) {
        throw new ConflictError("Disponibilidade inconsistente ao expirar reserva.");
      }

      await transaction.paymentTransaction.updateMany({
        where: {
          reservationId: candidate.id,
          status: "awaiting_payment",
        },
        data: {
          status: "cancelled",
          paidAt: null,
        },
      });

      return true;
    });

    if (didExpire) {
      expired += 1;
    }
  }

  return {
    expired,
    scanned: candidates.length,
  };
}
