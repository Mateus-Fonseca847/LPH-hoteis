import Stripe from "stripe";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} deve ser configurado.`);
  }

  return value;
}

export function getStripe() {
  return new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-04-22.dahlia",
  });
}

export function getStripeWebhookSecret() {
  return getRequiredEnv("STRIPE_WEBHOOK_SECRET");
}
