import { ValidationError } from "@/lib/errors/app-error";
import { upsertInitialPaymentTransactionForReservation } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/encryption";

import {
  assertConfiguredPaymentProvider,
  getConfiguredPaymentProvider,
  getPaymentAccessToken,
  getPaymentWebhookUrl,
  type RealPaymentProvider,
} from "./config";
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
  provider: RealPaymentProvider;
  accessToken: string;
};

type StartReservationPaymentInput = {
  reservationId: string;
  method: PaymentMethod;
  origin: string;
};

function getConfiguredAccessToken(encryptedAccessToken?: string | null) {
  const provider = getConfiguredPaymentProvider();

  if (!encryptedAccessToken) {
    return getPaymentAccessToken(provider);
  }

  return decryptSecret(encryptedAccessToken, "PAYMENT_SECRETS_ENCRYPTION_KEY");
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const provider = assertConfiguredPaymentProvider(input.provider);

  if (provider === "mercado_pago") {
    return createMercadoPagoPayment(input);
  }

  throw new ValidationError("Pagamento online não configurado para este hotel.");
}

export function resolveHotelPaymentConfiguration(
  settings?: {
    provider: "manual" | "mercado_pago";
    isEnabled: boolean;
    encryptedAccessToken?: string | null;
  } | null
): PaymentConfiguration {
  const provider = getConfiguredPaymentProvider();

  if (!settings?.isEnabled || settings.provider !== provider) {
    throw new ValidationError("Pagamento online não configurado para este hotel.");
  }

  return {
    provider,
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
    provider: paymentConfiguration.provider,
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
    notificationUrl: getPaymentWebhookUrl(paymentConfiguration.provider, origin),
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
  await upsertInitialPaymentTransactionForReservation(
    reservation.id,
    payment.status,
    payment.providerPaymentId
  );

  return payment;
}
