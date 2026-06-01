import { ConflictError, ValidationError } from "@/lib/errors/app-error";
import {
  getMercadoPagoPayment,
  searchMercadoPagoPaymentByReservationId,
} from "@/lib/payments/mercado-pago";
import {
  isPaymentWebhookAlreadyProcessed,
  validatePaymentWebhookIdentity,
} from "@/lib/payments/webhook-idempotency";
import { prisma } from "@/lib/prisma";
import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";
import { decryptSecret } from "@/lib/security/encryption";

type MercadoPagoPayment = Awaited<ReturnType<typeof getMercadoPagoPayment>>;

type SyncMercadoPagoPaymentInput = {
  paymentId?: string | null;
  preferenceId?: string | null;
  reservationId?: string | null;
  source: "webhook" | "manual" | "routine" | "return";
};

type PaymentLookup = NonNullable<Awaited<ReturnType<typeof findReservationPaymentContext>>>;

const FINAL_FAILED_STATUSES = ["rejected", "cancelled", "refunded", "charged_back"];

function trimOrNull(value?: string | null) {
  return value?.trim() || null;
}

function decryptAccessToken(encryptedAccessToken?: string | null) {
  return encryptedAccessToken
    ? decryptSecret(encryptedAccessToken, "PAYMENT_SECRETS_ENCRYPTION_KEY")
    : null;
}

async function createReconciliationLog({
  input,
  reservationId,
  hotelId,
  remoteStatus,
  success,
  error,
}: {
  input: SyncMercadoPagoPaymentInput;
  reservationId?: string | null;
  hotelId?: string | null;
  remoteStatus?: string | null;
  success: boolean;
  error?: string | null;
}) {
  try {
    await prisma.paymentReconciliationLog.create({
      data: {
        reservationId: reservationId ?? null,
        hotelId: hotelId ?? null,
        provider: "mercado_pago",
        source: input.source,
        paymentId: trimOrNull(input.paymentId),
        preferenceId: trimOrNull(input.preferenceId),
        remoteStatus: remoteStatus ?? null,
        success,
        error: error ?? null,
      },
    });
  } catch (logError) {
    console.error("[mercado-pago/reconciliation] Falha ao salvar log.", {
      reservationId,
      remoteStatus,
      error: logError,
    });
  }
}

async function getReservationForEmail(reservationId: string) {
  return prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      hotel: true,
      room: true,
    },
  });
}

function getReservationEmailInput(reservation: Awaited<ReturnType<typeof getReservationForEmail>>) {
  if (!reservation) {
    throw new ValidationError("Reserva nao encontrada.");
  }

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

async function notifyPaidReservation(reservationId: string) {
  const reservation = await getReservationForEmail(reservationId);
  const emailInput = getReservationEmailInput(reservation);

  try {
    await sendHotelReservationEmail(emailInput);
  } catch (error) {
    console.error("[mercado-pago/reconciliation] Falha ao enviar e-mail para o hotel.", {
      reservationId,
      error,
    });
  }

  try {
    await sendGuestReservationEmail(emailInput);
  } catch (error) {
    console.error("[mercado-pago/reconciliation] Falha ao enviar e-mail para o hospede.", {
      reservationId,
      error,
    });
  }
}

async function findReservationPaymentContext(input: {
  paymentId?: string | null;
  preferenceId?: string | null;
  reservationId?: string | null;
}) {
  const paymentId = trimOrNull(input.paymentId);
  const preferenceId = trimOrNull(input.preferenceId);
  const reservationId = trimOrNull(input.reservationId);

  const select = {
    id: true,
    hotelId: true,
    paymentProvider: true,
    providerPaymentId: true,
    paymentStatus: true,
    totalPriceCents: true,
    currency: true,
    paymentTransaction: {
      select: {
        id: true,
        provider: true,
        providerPaymentId: true,
        status: true,
        grossAmountCents: true,
        currency: true,
      },
    },
    hotel: {
      select: {
        paymentSettings: {
          select: {
            encryptedAccessToken: true,
          },
        },
      },
    },
  } as const;

  if (reservationId) {
    return prisma.reservation.findUnique({
      where: {
        id: reservationId,
      },
      select,
    });
  }

  const providerPaymentId = paymentId ?? preferenceId;

  if (!providerPaymentId) {
    return null;
  }

  return prisma.reservation.findFirst({
    where: {
      OR: [
        {
          providerPaymentId,
        },
        {
          paymentTransaction: {
            is: {
              providerPaymentId,
            },
          },
        },
      ],
    },
    select,
  });
}

async function resolvePayment(input: SyncMercadoPagoPaymentInput) {
  const initialContext = await findReservationPaymentContext(input);
  const accessToken = decryptAccessToken(
    initialContext?.hotel.paymentSettings?.encryptedAccessToken
  );
  const paymentId = trimOrNull(input.paymentId);

  if (paymentId) {
    return getMercadoPagoPayment(paymentId, accessToken);
  }

  const reservationId = trimOrNull(input.reservationId) ?? initialContext?.id;

  if (!reservationId) {
    throw new ValidationError("Informe paymentId, preferenceId ou reservationId.");
  }

  const payment = await searchMercadoPagoPaymentByReservationId(reservationId, accessToken);

  if (!payment) {
    throw new ValidationError("Pagamento nao encontrado no Mercado Pago.");
  }

  return payment;
}

async function findContextForPayment(
  payment: MercadoPagoPayment,
  input: SyncMercadoPagoPaymentInput
) {
  const context = await findReservationPaymentContext({
    paymentId: payment.id,
    preferenceId: input.preferenceId,
    reservationId: payment.reservationId ?? input.reservationId,
  });

  if (!context) {
    throw new ValidationError("Reserva do pagamento nao encontrada.");
  }

  return context;
}

function validatePaymentReservationLink(payment: MercadoPagoPayment, context: PaymentLookup) {
  const transaction = context.paymentTransaction;

  if (context.paymentProvider && context.paymentProvider !== "mercado_pago") {
    throw new ValidationError("Reserva nao usa Mercado Pago.");
  }

  if (transaction?.provider && transaction.provider !== "mercado_pago") {
    throw new ValidationError("Transacao nao usa Mercado Pago.");
  }

  if (!payment.reservationId || payment.reservationId !== context.id) {
    throw new ValidationError("Pagamento nao corresponde a reserva.");
  }

  if (
    payment.totalPriceCents !== context.totalPriceCents ||
    payment.currency !== context.currency ||
    (transaction &&
      (payment.totalPriceCents !== transaction.grossAmountCents ||
        payment.currency !== transaction.currency))
  ) {
    throw new ValidationError("Valor do pagamento nao corresponde a reserva.");
  }

  if (
    (transaction?.status === "paid" || context.paymentStatus === "paid") &&
    context.providerPaymentId &&
    context.providerPaymentId !== payment.id
  ) {
    throw new ConflictError("Reserva ja vinculada a outro pagamento aprovado.");
  }

  validatePaymentWebhookIdentity({
    reservation: context,
    externalReference: payment.reservationId,
    providerPaymentId: payment.id,
    paymentTransaction: transaction
      ? {
          ...transaction,
          reservation: context,
        }
      : null,
  });
}

async function applyPaymentStatus(payment: MercadoPagoPayment, context: PaymentLookup) {
  validatePaymentReservationLink(payment, context);

  const paymentTransaction = context.paymentTransaction
    ? {
        ...context.paymentTransaction,
        reservation: context,
      }
    : null;

  if (
    isPaymentWebhookAlreadyProcessed({
      reservation: context,
      externalReference: payment.reservationId,
      providerPaymentId: payment.id,
      paymentTransaction,
    })
  ) {
    return {
      changed: false,
      reservationId: context.id,
      remoteStatus: payment.status,
    };
  }

  if (payment.status === "approved") {
    const confirmation = await confirmPaidReservation({
      reservationId: context.id,
      providerPaymentId: payment.id,
      paymentMethod: payment.paymentTypeId || payment.paymentMethodId,
    });

    if (confirmation?.confirmed) {
      await notifyPaidReservation(context.id);
    }

    return {
      changed: Boolean(confirmation?.confirmed),
      reservationId: context.id,
      remoteStatus: payment.status,
    };
  }

  if (FINAL_FAILED_STATUSES.includes(payment.status)) {
    const status = ["cancelled", "refunded", "charged_back"].includes(payment.status)
      ? "cancelled"
      : "payment_failed";
    const changed = await closeUnpaidReservation({
      reservationId: context.id,
      status,
      providerPaymentId: payment.id,
    });

    return {
      changed,
      reservationId: context.id,
      remoteStatus: payment.status,
    };
  }

  return {
    changed: false,
    reservationId: context.id,
    remoteStatus: payment.status,
  };
}

export async function syncMercadoPagoPayment(input: SyncMercadoPagoPaymentInput) {
  let context: Awaited<ReturnType<typeof findReservationPaymentContext>> = null;
  let payment: MercadoPagoPayment | null = null;

  try {
    context = await findReservationPaymentContext(input);
    payment = await resolvePayment(input);
    context = await findContextForPayment(payment, input);

    const result = await applyPaymentStatus(payment, context);

    await createReconciliationLog({
      input: {
        ...input,
        paymentId: payment.id,
      },
      reservationId: context.id,
      hotelId: context.hotelId,
      remoteStatus: payment.status,
      success: true,
    });

    return result;
  } catch (error) {
    await createReconciliationLog({
      input,
      reservationId: context?.id ?? trimOrNull(input.reservationId),
      hotelId: context?.hotelId,
      remoteStatus: payment?.status,
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    });

    throw error;
  }
}

export async function reconcileRecentAwaitingMercadoPagoReservations({
  now = new Date(),
  minutes = 120,
  limit = 100,
}: {
  now?: Date;
  minutes?: number;
  limit?: number;
} = {}) {
  const since = new Date(now.getTime() - Math.max(minutes, 1) * 60 * 1000);
  const candidates = await prisma.reservation.findMany({
    where: {
      status: "awaiting_payment",
      paymentStatus: "awaiting_payment",
      paymentProvider: "mercado_pago",
      createdAt: {
        gte: since,
      },
    },
    select: {
      id: true,
      providerPaymentId: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.min(Math.max(limit, 1), 500),
  });

  let reconciled = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result = await syncMercadoPagoPayment({
        reservationId: candidate.id,
        preferenceId: candidate.providerPaymentId,
        source: "routine",
      });

      if (result.changed) {
        reconciled += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    scanned: candidates.length,
    reconciled,
    failed,
  };
}
