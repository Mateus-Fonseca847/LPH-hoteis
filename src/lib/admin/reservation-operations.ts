import type { Prisma } from "@prisma/client";

import { AuthorizationError, requireHotelAdminAccess } from "@/lib/auth/authorization";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import {
  closeUnpaidReservation,
  confirmPaidReservation,
  releaseReservationAvailability,
} from "@/lib/reservation-confirmation";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";

type ReservationOperationAction =
  | "reservation.cancelled"
  | "reservation.manually_confirmed"
  | "reservation.payment_failed"
  | "reservation.confirmation_email_resent"
  | "reservation.internal_note_added";

type ReservationOperationInput = {
  reservationId: string;
  userId: string;
  reason: string;
};

function normalizeReason(reason: string) {
  const value = reason.trim();

  if (value.length < 5) {
    throw new ValidationError("Informe um motivo com pelo menos 5 caracteres.");
  }

  if (value.length > 1000) {
    throw new ValidationError("Motivo deve ter ate 1000 caracteres.");
  }

  return value;
}

async function getReservationForOperation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      hotel: true,
      room: true,
      paymentTransaction: true,
    },
  });

  if (!reservation) {
    throw new NotFoundError("Reserva nao encontrada.");
  }

  return reservation;
}

async function assertReservationAdminAccess(userId: string, hotelId: string) {
  try {
    await requireHotelAdminAccess(userId, hotelId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new AuthorizationError("Usuario nao autorizado para operar esta reserva.");
    }

    throw error;
  }
}

async function createOperationLog({
  reservation,
  userId,
  action,
  reason,
  nextStatus,
  nextPaymentStatus,
  metadata,
}: {
  reservation: Awaited<ReturnType<typeof getReservationForOperation>>;
  userId: string;
  action: ReservationOperationAction;
  reason: string;
  nextStatus?: string | null;
  nextPaymentStatus?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  return prisma.reservationOperationLog.create({
    data: {
      reservationId: reservation.id,
      hotelId: reservation.hotelId,
      createdById: userId,
      action,
      reason,
      previousStatus: reservation.status,
      nextStatus: nextStatus ?? reservation.status,
      previousPaymentStatus: reservation.paymentStatus,
      nextPaymentStatus: nextPaymentStatus ?? reservation.paymentStatus,
      metadata,
    },
  });
}

function getReservationEmailInput(reservation: Awaited<ReturnType<typeof getReservationForOperation>>) {
  return {
    hotelEmail: reservation.hotel.email,
    hotelName: reservation.hotel.name,
    roomName: reservation.room.name,
    guestName: reservation.guestName,
    guestEmail: reservation.guestEmail,
    guestPhone: reservation.guestPhone,
    guestDocument: reservation.guestDocument ?? undefined,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    adults: reservation.adults,
    children: reservation.children,
    nights: reservation.nights,
    nightlyPriceCents: reservation.nightlyPriceCents,
    totalPriceCents: reservation.totalPriceCents,
    reservationId: reservation.id,
    paymentMethod: reservation.paymentMethod,
  };
}

export async function cancelReservationManually(input: ReservationOperationInput) {
  const reason = normalizeReason(input.reason);
  const reservation = await getReservationForOperation(input.reservationId);
  await assertReservationAdminAccess(input.userId, reservation.hotelId);

  if (["cancelled", "expired"].includes(reservation.status)) {
    throw new ConflictError("Reserva ja esta cancelada ou expirada.");
  }

  if (reservation.paymentStatus === "paid" || reservation.paymentTransaction?.status === "paid") {
    await releaseReservationAvailability(reservation.id);
    await prisma.reservation.update({
      where: {
        id: reservation.id,
      },
      data: {
        status: "cancelled",
      },
    });
    await createOperationLog({
      reservation,
      userId: input.userId,
      action: "reservation.cancelled",
      reason,
      nextStatus: "cancelled",
      nextPaymentStatus: reservation.paymentStatus,
    });

    return { status: "cancelled" as const };
  }

  const changed = await closeUnpaidReservation({
    reservationId: reservation.id,
    status: "cancelled",
    providerPaymentId: reservation.providerPaymentId,
  });

  if (!changed) {
    throw new ConflictError("Reserva nao pode ser cancelada neste estado.");
  }

  await createOperationLog({
    reservation,
    userId: input.userId,
    action: "reservation.cancelled",
    reason,
    nextStatus: "cancelled",
    nextPaymentStatus: "cancelled",
  });

  return { status: "cancelled" as const };
}

export async function confirmReservationManually(input: ReservationOperationInput) {
  const reason = normalizeReason(input.reason);
  const reservation = await getReservationForOperation(input.reservationId);
  await assertReservationAdminAccess(input.userId, reservation.hotelId);

  if (reservation.paymentStatus === "paid") {
    throw new ConflictError("Reserva ja possui pagamento confirmado.");
  }

  if (!["pending", "awaiting_payment"].includes(reservation.status)) {
    throw new ConflictError("Reserva nao pode ser confirmada manualmente neste estado.");
  }

  const confirmation = await confirmPaidReservation({
    reservationId: reservation.id,
    providerPaymentId: reservation.providerPaymentId ?? `manual-${reservation.id}`,
    paymentMethod: reservation.paymentMethod ?? "manual",
  });

  if (!confirmation?.confirmed) {
    throw new ConflictError("Reserva nao pode ser confirmada manualmente.");
  }

  await createOperationLog({
    reservation,
    userId: input.userId,
    action: "reservation.manually_confirmed",
    reason,
    nextStatus: "confirmed",
    nextPaymentStatus: "paid",
  });

  return { status: "confirmed" as const };
}

export async function markReservationPaymentFailed(input: ReservationOperationInput) {
  const reason = normalizeReason(input.reason);
  const reservation = await getReservationForOperation(input.reservationId);
  await assertReservationAdminAccess(input.userId, reservation.hotelId);

  if (reservation.paymentStatus === "paid" || reservation.paymentTransaction?.status === "paid") {
    throw new ConflictError("Pagamento aprovado nao pode ser marcado como falho.");
  }

  const changed = await closeUnpaidReservation({
    reservationId: reservation.id,
    status: "payment_failed",
    providerPaymentId: reservation.providerPaymentId,
  });

  if (!changed) {
    throw new ConflictError("Reserva nao pode receber falha de pagamento neste estado.");
  }

  await createOperationLog({
    reservation,
    userId: input.userId,
    action: "reservation.payment_failed",
    reason,
    nextStatus: "payment_failed",
    nextPaymentStatus: "payment_failed",
  });

  return { status: "payment_failed" as const };
}

export async function resendReservationConfirmationEmail(input: ReservationOperationInput) {
  const reason = normalizeReason(input.reason);
  const reservation = await getReservationForOperation(input.reservationId);
  await assertReservationAdminAccess(input.userId, reservation.hotelId);

  if (reservation.status !== "confirmed" && reservation.paymentStatus !== "paid") {
    throw new ConflictError("E-mail de confirmacao so pode ser reenviado para reserva confirmada.");
  }

  const emailInput = getReservationEmailInput(reservation);
  await sendHotelReservationEmail(emailInput);
  await sendGuestReservationEmail(emailInput);
  await createOperationLog({
    reservation,
    userId: input.userId,
    action: "reservation.confirmation_email_resent",
    reason,
    metadata: {
      guestEmail: reservation.guestEmail,
      hotelEmail: reservation.hotel.email,
    },
  });

  return { status: "sent" as const };
}

export async function addReservationInternalNote(input: ReservationOperationInput) {
  const reason = normalizeReason(input.reason);
  const reservation = await getReservationForOperation(input.reservationId);
  await assertReservationAdminAccess(input.userId, reservation.hotelId);
  await createOperationLog({
    reservation,
    userId: input.userId,
    action: "reservation.internal_note_added",
    reason,
  });

  return { status: "noted" as const };
}
