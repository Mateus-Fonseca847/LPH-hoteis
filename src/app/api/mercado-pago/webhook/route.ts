import { createHmac, timingSafeEqual } from "node:crypto";

import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import {
  upsertInitialPaymentTransactionForReservation,
  upsertPaidPaymentTransactionForReservation,
} from "@/lib/finance/payment-transactions";
import { getMercadoPagoPayment } from "@/lib/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";

const WEBHOOK_FAILURE_MESSAGE = "Não foi possível processar o webhook de pagamento.";

type MercadoPagoWebhookPayload = {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ValidationError(`${name} não configurado.`);
  }

  return value;
}

function parseSignature(signature: string) {
  return Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");

      return [key?.trim(), value?.trim()];
    })
  );
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

function validateMercadoPagoSignature(request: Request, paymentId: string) {
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const secret =
    process.env.PAYMENT_WEBHOOK_SECRET?.trim() || getRequiredEnv("MERCADO_PAGO_WEBHOOK_SECRET");

  if (!signature || !requestId) {
    throw new ValidationError("Assinatura do webhook ausente.");
  }

  const parsedSignature = parseSignature(signature);
  const timestamp = parsedSignature.ts;
  const expectedSignature = parsedSignature.v1;

  if (!timestamp || !expectedSignature) {
    throw new ValidationError("Assinatura do webhook inválida.");
  }

  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const calculatedSignature = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeCompare(calculatedSignature, expectedSignature)) {
    throw new ValidationError("Assinatura do webhook inválida.");
  }
}

function getPaymentId(payload: MercadoPagoWebhookPayload, request: Request) {
  const url = new URL(request.url);
  const queryPaymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const payloadPaymentId = payload.data?.id;
  const paymentId = queryPaymentId || (payloadPaymentId ? String(payloadPaymentId) : "");

  if (!paymentId) {
    throw new ValidationError("Pagamento não informado no webhook.");
  }

  return paymentId;
}

function isPaymentEvent(payload: MercadoPagoWebhookPayload) {
  return payload.type === "payment" || payload.action?.startsWith("payment.");
}

function getReservationEmailInput(reservation: Awaited<ReturnType<typeof getReservationForEmail>>) {
  if (!reservation) {
    throw new ValidationError("Reserva não encontrada.");
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

async function notifyPaidReservation(reservationId: string) {
  const reservation = await getReservationForEmail(reservationId);
  const emailInput = getReservationEmailInput(reservation);

  try {
    await sendHotelReservationEmail(emailInput);
  } catch (error) {
    console.error("[mercado-pago/webhook] Falha ao enviar e-mail para o hotel.", {
      reservationId,
      error,
    });
  }

  try {
    await sendGuestReservationEmail(emailInput);
  } catch (error) {
    console.error("[mercado-pago/webhook] Falha ao enviar e-mail para o hóspede.", {
      reservationId,
      error,
    });
  }
}

async function findPaymentTransaction(paymentId: string, reservationId?: string | null) {
  const byProviderPaymentId = await prisma.paymentTransaction.findUnique({
    where: {
      providerPaymentId: paymentId,
    },
    select: {
      id: true,
      status: true,
      reservation: {
        select: {
          id: true,
          paymentStatus: true,
        },
      },
    },
  });

  if (byProviderPaymentId || !reservationId) {
    return byProviderPaymentId;
  }

  return prisma.paymentTransaction.findUnique({
    where: {
      reservationId,
    },
    select: {
      id: true,
      status: true,
      reservation: {
        select: {
          id: true,
          paymentStatus: true,
        },
      },
    },
  });
}

async function handleApprovedPayment(paymentId: string) {
  const payment = await getMercadoPagoPayment(paymentId);
  const paymentTransaction = await findPaymentTransaction(payment.id, payment.reservationId);
  const reservation = paymentTransaction?.reservation;

  if (!reservation) {
    throw new ValidationError("Reserva do pagamento não encontrada.");
  }

  if (paymentTransaction.status === "paid" || reservation.paymentStatus === "paid") {
    await upsertPaidPaymentTransactionForReservation(reservation.id);
    return;
  }

  const paidAt = new Date();
  const updateResult = await prisma.reservation.updateMany({
    where: {
      id: reservation.id,
      paymentStatus: {
        not: "paid",
      },
    },
    data: {
      status: "confirmed",
      paymentStatus: "paid",
      providerPaymentId: payment.id,
      paymentMethod: payment.paymentTypeId || payment.paymentMethodId,
      paidAt,
    },
  });

  await upsertPaidPaymentTransactionForReservation(reservation.id);

  if (updateResult.count > 0) {
    await notifyPaidReservation(reservation.id);
  }
}

async function handleRejectedPayment(paymentId: string) {
  const payment = await getMercadoPagoPayment(paymentId);
  const paymentTransaction = await findPaymentTransaction(payment.id, payment.reservationId);
  const reservation = paymentTransaction?.reservation;

  if (!reservation || reservation.paymentStatus === "paid") {
    return;
  }

  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },
    data: {
      status: "payment_failed",
      paymentStatus: "payment_failed",
      providerPaymentId: payment.id,
    },
  });
  await upsertInitialPaymentTransactionForReservation(reservation.id, "payment_failed", payment.id);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as MercadoPagoWebhookPayload | null;

    if (!payload) {
      throw new ValidationError("Payload do webhook inválido.");
    }

    const paymentId = getPaymentId(payload, request);

    validateMercadoPagoSignature(request, paymentId);

    if (!isPaymentEvent(payload)) {
      return createApiSuccessResponse({
        received: true,
      });
    }

    const payment = await getMercadoPagoPayment(paymentId);

    if (payment.status === "approved") {
      await handleApprovedPayment(payment.id);
    }

    if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
      await handleRejectedPayment(payment.id);
    }

    return createApiSuccessResponse({
      received: true,
    });
  } catch (error) {
    return createApiErrorResponse(error, WEBHOOK_FAILURE_MESSAGE);
  }
}
