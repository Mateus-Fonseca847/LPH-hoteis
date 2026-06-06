import { ValidationError } from "@/lib/errors/app-error";

import type { PaymentProvider } from "./types";

const REAL_PAYMENT_PROVIDERS = ["mercado_pago"] as const satisfies readonly PaymentProvider[];

export type RealPaymentProvider = (typeof REAL_PAYMENT_PROVIDERS)[number];

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function isRealPaymentProvider(provider: string): provider is RealPaymentProvider {
  return REAL_PAYMENT_PROVIDERS.includes(provider as RealPaymentProvider);
}

export function getConfiguredPaymentProvider(): RealPaymentProvider {
  const provider = getEnv("PAYMENT_PROVIDER") || "mercado_pago";

  if (!isRealPaymentProvider(provider)) {
    throw new ValidationError("Provedor de pagamento não configurado ou indisponível.");
  }

  return provider;
}

export function assertConfiguredPaymentProvider(provider: PaymentProvider): RealPaymentProvider {
  const configuredProvider = getConfiguredPaymentProvider();

  if (provider !== configuredProvider) {
    throw new ValidationError("Provedor de pagamento não está habilitado neste ambiente.");
  }

  return configuredProvider;
}

export function getPaymentAccessToken(
  provider: RealPaymentProvider,
  overrideToken?: string | null
) {
  const token =
    overrideToken?.trim() ||
    getEnv("PAYMENT_ACCESS_TOKEN") ||
    (provider === "mercado_pago" ? getEnv("MERCADO_PAGO_ACCESS_TOKEN") : "");

  if (!token) {
    throw new ValidationError("Credenciais do provedor de pagamento não configuradas.");
  }

  return token;
}

export function getPaymentWebhookSecret(provider: RealPaymentProvider) {
  const secret =
    getEnv("PAYMENT_WEBHOOK_SECRET") ||
    (provider === "mercado_pago" ? getEnv("MERCADO_PAGO_WEBHOOK_SECRET") : "");

  if (!secret) {
    throw new ValidationError("Segredo do webhook de pagamento não configurado.");
  }

  return secret;
}

export function getPaymentWebhookUrl(provider: RealPaymentProvider, origin: string) {
  const url =
    getEnv("PAYMENT_WEBHOOK_URL") ||
    (provider === "mercado_pago" ? getEnv("MERCADO_PAGO_WEBHOOK_URL") : "");

  return url || `${origin}/api/mercado-pago/webhook`;
}
