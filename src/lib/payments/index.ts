import { ValidationError } from "@/lib/errors/app-error";
import { decryptSecret } from "@/lib/security/encryption";

import {
  assertConfiguredPaymentProvider,
  getConfiguredPaymentProvider,
  getPaymentAccessToken,
  type RealPaymentProvider,
} from "./config";
import { createMercadoPagoPayment } from "./mercado-pago";
import type { CreatePaymentInput, CreatePaymentResult } from "./types";

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
