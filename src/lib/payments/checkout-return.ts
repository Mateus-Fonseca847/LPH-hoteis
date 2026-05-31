import type { PaymentStatus, ReservationStatus } from "@prisma/client";

import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";
import { prisma } from "@/lib/prisma";

type CheckoutReturnParams = {
  checkout?: string;
  reservation?: string;
  external_reference?: string;
  payment?: string;
  payment_id?: string;
  collection_id?: string;
  preference?: string;
  preference_id?: string;
};

type CheckoutReservation = {
  id: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: "manual" | "mercado_pago" | null;
  providerPaymentId: string | null;
};

export type CheckoutReturnNotice = {
  tone: "success" | "processing" | "error";
  title: string;
  description: string;
};

function firstParam(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) ?? null;
}

function buildNotice(reservation: CheckoutReservation | null): CheckoutReturnNotice {
  if (!reservation) {
    return {
      tone: "error",
      title: "Reserva nao encontrada",
      description:
        "Nao encontramos a reserva informada no retorno do pagamento. Entre em contato com o hotel para conferir a tentativa.",
    };
  }

  if (reservation.status === "confirmed" || reservation.paymentStatus === "paid") {
    return {
      tone: "success",
      title: "Reserva confirmada",
      description: `Reserva ${reservation.id} confirmada com pagamento aprovado. O hotel e o hospede receberao os e-mails de confirmacao.`,
    };
  }

  if (reservation.status === "awaiting_payment" || reservation.paymentStatus === "awaiting_payment") {
    return {
      tone: "processing",
      title: "Pagamento em processamento",
      description:
        "Sua reserva ainda aguarda confirmacao do provedor. Atualizaremos automaticamente quando o pagamento for aprovado.",
    };
  }

  if (reservation.status === "expired") {
    return {
      tone: "error",
      title: "Reserva expirada",
      description: "O prazo para pagamento terminou. Consulte disponibilidade para reservar novamente.",
    };
  }

  if (reservation.status === "cancelled" || reservation.paymentStatus === "cancelled") {
    return {
      tone: "error",
      title: "Pagamento cancelado",
      description: "Nenhuma cobranca foi confirmada. Consulte disponibilidade para tentar novamente.",
    };
  }

  if (reservation.status === "payment_failed" || reservation.paymentStatus === "payment_failed") {
    return {
      tone: "error",
      title: "Pagamento nao aprovado",
      description: "O pagamento nao foi aprovado pelo provedor. Consulte disponibilidade para tentar novamente.",
    };
  }

  return {
    tone: "processing",
    title: "Pagamento em processamento",
    description:
      "Sua reserva ainda esta sendo atualizada. Atualizaremos automaticamente quando o provedor confirmar o pagamento.",
  };
}

async function findReservation(params: {
  reservationId: string | null;
  preferenceId: string | null;
}) {
  const select = {
    id: true,
    status: true,
    paymentStatus: true,
    paymentProvider: true,
    providerPaymentId: true,
  } as const;

  if (params.reservationId) {
    return prisma.reservation.findUnique({
      where: {
        id: params.reservationId,
      },
      select,
    });
  }

  if (!params.preferenceId) {
    return null;
  }

  return prisma.reservation.findFirst({
    where: {
      paymentProvider: "mercado_pago",
      OR: [
        {
          providerPaymentId: params.preferenceId,
        },
        {
          paymentTransaction: {
            is: {
              providerPaymentId: params.preferenceId,
            },
          },
        },
      ],
    },
    select,
  });
}

function shouldTryReconciliation(reservation: CheckoutReservation | null, checkout?: string) {
  return (
    checkout === "success" &&
    (!reservation ||
      (reservation.paymentProvider === "mercado_pago" &&
        (reservation.status === "awaiting_payment" ||
          reservation.paymentStatus === "awaiting_payment")))
  );
}

export async function getMercadoPagoCheckoutReturnNotice(
  params: CheckoutReturnParams
): Promise<CheckoutReturnNotice | null> {
  if (!params.checkout) {
    return null;
  }

  const reservationId = firstParam(params.reservation, params.external_reference);
  const paymentId = firstParam(params.payment, params.payment_id, params.collection_id);
  const preferenceId = firstParam(params.preference, params.preference_id);
  let reservation = await findReservation({ reservationId, preferenceId });

  if (shouldTryReconciliation(reservation, params.checkout) && (reservation || paymentId)) {
    try {
      const result = await syncMercadoPagoPayment({
        reservationId: reservation?.id ?? reservationId,
        paymentId,
        preferenceId: preferenceId ?? reservation?.providerPaymentId ?? null,
        source: "return",
      });

      reservation = await findReservation({
        reservationId: reservation?.id ?? result.reservationId ?? reservationId,
        preferenceId: preferenceId ?? reservation?.providerPaymentId ?? null,
      });
    } catch (error) {
      console.error("[checkout-return] Falha ao reconciliar retorno Mercado Pago.", {
        reservationId: reservation?.id ?? reservationId,
        paymentId,
        preferenceId,
        error,
      });
    }
  }

  return buildNotice(reservation);
}
