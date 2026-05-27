import { ConflictError, ValidationError } from "@/lib/errors/app-error";
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

  if (
    !reservation.hotel.isPublished ||
    !reservation.room.isActive ||
    !reservation.room.isAvailable
  ) {
    throw new ConflictError("Hospedagem indisponível para iniciar pagamento.");
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

  await prisma.$transaction(async (transaction) => {
    const reservationUpdate = await transaction.reservation.updateMany({
      where: {
        id: reservation.id,
        status: {
          in: ["pending", "awaiting_payment"],
        },
        paymentStatus: {
          in: ["pending", "awaiting_payment"],
        },
        hotel: {
          is: {
            isPublished: true,
          },
        },
        room: {
          is: {
            isActive: true,
            isAvailable: true,
          },
        },
      },
      data: {
        status: payment.status,
        paymentProvider: payment.provider,
        paymentMethod: method,
        paymentStatus: payment.status,
        providerPaymentId: payment.providerPaymentId,
      },
    });

    if (reservationUpdate.count !== 1) {
      throw new ConflictError("Reserva não está disponível para iniciar pagamento.");
    }

    const paymentTransactionUpdate = await transaction.paymentTransaction.updateMany({
      where: {
        reservationId: reservation.id,
        status: {
          in: ["pending", "awaiting_payment"],
        },
      },
      data: {
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        paymentMethod: method,
        status: payment.status,
      },
    });

    if (paymentTransactionUpdate.count !== 1) {
      throw new ConflictError("Pagamento da reserva não pôde ser associado.");
    }
  });

  return payment;
}
