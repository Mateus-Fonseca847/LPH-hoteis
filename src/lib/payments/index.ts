import { decryptSecret } from "@/lib/security/encryption";
import { ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";

import { createMercadoPagoPayment } from "./mercado-pago";
import type { CreatePaymentInput, CreatePaymentResult, PaymentMethod } from "./types";

export type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from "./types";

export type PaymentConfiguration = {
  provider: "mercado_pago";
  accessToken: string;
};

type StartReservationPaymentInput = {
  reservationId: string;
  method: PaymentMethod;
  origin: string;
};

function getConfiguredAccessToken(encryptedAccessToken?: string | null) {
  if (!encryptedAccessToken) {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

    if (!token) {
    throw new ValidationError("Mercado Pago não está configurado para este hotel.");
    }

    return token;
  }

  return decryptSecret(encryptedAccessToken, "PAYMENT_SECRETS_ENCRYPTION_KEY");
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  if (input.provider !== "mercado_pago") {
    throw new ValidationError("Pagamento online não configurado para este hotel.");
  }

  return createMercadoPagoPayment(input);
}

export function resolveHotelPaymentConfiguration(
  settings?: {
    provider: "manual" | "mercado_pago";
    isEnabled: boolean;
    encryptedAccessToken?: string | null;
  } | null
): PaymentConfiguration {
  if (!settings?.isEnabled || settings.provider !== "mercado_pago") {
    throw new ValidationError("Pagamento online não configurado para este hotel.");
  }

  return {
    provider: "mercado_pago",
    accessToken: getConfiguredAccessToken(settings.encryptedAccessToken),
  };
}

export async function startReservationPayment({
  reservationId,
  method,
  origin,
}: StartReservationPaymentInput) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      hotel: {
        include: {
          paymentSettings: true,
        },
      },
      room: true,
    },
  });

  if (!reservation) {
    throw new ValidationError("Reserva não encontrada.");
  }

  const settings = reservation.hotel.paymentSettings;
  const paymentConfiguration = resolveHotelPaymentConfiguration(settings);

  const successUrl = `${origin}/hoteis/${reservation.hotel.slug}?checkout=success&reservation=${reservation.id}`;
  const failureUrl = `${origin}/hoteis/${reservation.hotel.slug}?checkout=cancelled&reservation=${reservation.id}`;
  const payment = await createPayment({
    provider: "mercado_pago",
    method,
    reservationId: reservation.id,
    hotelName: reservation.hotel.name,
    roomName: reservation.room.name,
    guestName: reservation.guestName,
    guestEmail: reservation.guestEmail,
    totalPriceCents: reservation.totalPriceCents,
    currency: "BRL",
    description: `${reservation.nights} ${
      reservation.nights === 1 ? "noite" : "noites"
    } para ${reservation.adults} adulto(s) e ${reservation.children} crianca(s).`,
    successUrl,
    failureUrl,
    notificationUrl:
      process.env.MERCADO_PAGO_WEBHOOK_URL?.trim() || `${origin}/api/mercado-pago/webhook`,
    accessToken: paymentConfiguration.accessToken,
  });

  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },
    data: {
      status: payment.status,
      paymentProvider: payment.provider,
      paymentMethod: method,
      paymentStatus: payment.status,
      providerPaymentId: payment.providerPaymentId,
    },
  });

  return payment;
}
