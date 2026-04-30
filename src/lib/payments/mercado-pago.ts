import { InternalServerError, ValidationError } from "@/lib/errors/app-error";

import type { CreatePaymentInput, CreatePaymentResult, PaymentMethod } from "./types";

const MERCADO_PAGO_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";
const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
const MERCADO_PAGO_PAYMENT_TYPES = ["credit_card", "debit_card", "ticket", "bank_transfer"];

const PAYMENT_TYPE_BY_METHOD: Record<PaymentMethod, string> = {
  pix: "bank_transfer",
  credit_card: "credit_card",
  debit_card: "debit_card",
  boleto: "ticket",
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
  error?: string;
};

type MercadoPagoPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  payment_method_id?: string;
  payment_type_id?: string;
};

function getAccessToken(inputToken?: string | null) {
  const token = inputToken?.trim() || process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new ValidationError("Mercado Pago não está configurado para este hotel.");
  }

  return token;
}

function getCheckoutUrl(preference: MercadoPagoPreferenceResponse) {
  if (process.env.MERCADO_PAGO_SANDBOX === "true" && preference.sandbox_init_point) {
    return preference.sandbox_init_point;
  }

  return preference.init_point || preference.sandbox_init_point || null;
}

export async function createMercadoPagoPayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const selectedPaymentType = PAYMENT_TYPE_BY_METHOD[input.method];

  if (!selectedPaymentType) {
    throw new ValidationError("Forma de pagamento indisponível.");
  }

  const accessToken = getAccessToken(input.accessToken);
  const amount = input.totalPriceCents / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("Valor do pagamento inválido.");
  }

  const response = await fetch(MERCADO_PAGO_PREFERENCES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: `${input.hotelName} - ${input.roomName}`,
          description: input.description,
          quantity: 1,
          currency_id: input.currency,
          unit_price: amount,
        },
      ],
      payer: {
        name: input.guestName,
        email: input.guestEmail,
      },
      external_reference: input.reservationId,
      back_urls: {
        success: input.successUrl,
        failure: input.failureUrl,
        pending: input.failureUrl,
      },
      auto_return: "approved",
      notification_url: input.notificationUrl,
      payment_methods: {
        excluded_payment_types: MERCADO_PAGO_PAYMENT_TYPES.filter(
          (type) => type !== selectedPaymentType
        ).map((id) => ({ id })),
      },
    }),
  });

  const preference = (await response
    .json()
    .catch(() => null)) as MercadoPagoPreferenceResponse | null;

  if (!response.ok || !preference?.id) {
    throw new InternalServerError("Não foi possível iniciar o pagamento.", true);
  }

  const checkoutUrl = getCheckoutUrl(preference);

  if (!checkoutUrl) {
    throw new InternalServerError("Mercado Pago não retornou URL de pagamento.", true);
  }

  return {
    provider: "mercado_pago",
    providerPaymentId: preference.id,
    checkoutUrl,
    status: "awaiting_payment",
  };
}

export async function getMercadoPagoPayment(paymentId: string, accessToken?: string | null) {
  const response = await fetch(`${MERCADO_PAGO_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken(accessToken)}`,
    },
  });

  const payment = (await response.json().catch(() => null)) as MercadoPagoPaymentResponse | null;

  if (!response.ok || !payment?.id) {
    throw new ValidationError("Pagamento não encontrado no Mercado Pago.");
  }

  return {
    id: String(payment.id),
    status: payment.status || "unknown",
    statusDetail: payment.status_detail,
    reservationId: payment.external_reference,
    paymentMethodId: payment.payment_method_id,
    paymentTypeId: payment.payment_type_id,
  };
}
