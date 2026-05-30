import { describe, expect, it } from "vitest";

import {
  isPaymentWebhookAlreadyProcessed,
  validatePaymentWebhookIdentity,
} from "@/lib/payments/webhook-idempotency";

describe("payment webhook idempotency", () => {
  it("aceita webhook vinculado ao mesmo externalReference/reservationId", () => {
    expect(() =>
      validatePaymentWebhookIdentity({
        reservation: {
          id: "reservation-1",
          paymentStatus: "awaiting_payment",
        },
        externalReference: "reservation-1",
        reservationId: "reservation-1",
      })
    ).not.toThrow();
  });

  it("rejeita webhook que aponta para outra reserva", () => {
    expect(() =>
      validatePaymentWebhookIdentity({
        reservation: {
          id: "reservation-1",
          paymentStatus: "awaiting_payment",
        },
        externalReference: "reservation-2",
      })
    ).toThrow("Webhook não corresponde à reserva.");
  });

  it("rejeita identificador divergente em pagamento ja finalizado", () => {
    expect(() =>
      validatePaymentWebhookIdentity({
        reservation: {
          id: "reservation-1",
          providerPaymentId: "payment-1",
          paymentStatus: "paid",
        },
        providerPaymentId: "payment-2",
        paymentTransaction: {
          providerPaymentId: "payment-1",
          status: "paid",
        },
      })
    ).toThrow("Webhook já vinculado a outro identificador de pagamento.");
  });

  it("marca pagamento aprovado repetido como ja processado", () => {
    expect(
      isPaymentWebhookAlreadyProcessed({
        reservation: {
          id: "reservation-1",
          providerPaymentId: "payment-1",
          paymentStatus: "paid",
        },
        providerPaymentId: "payment-1",
        paymentTransaction: {
          providerPaymentId: "payment-1",
          status: "paid",
        },
      })
    ).toBe(true);
  });

  it("marca cancelamento repetido como ja processado", () => {
    expect(
      isPaymentWebhookAlreadyProcessed({
        reservation: {
          id: "reservation-1",
          providerPaymentId: "payment-1",
          paymentStatus: "cancelled",
        },
        providerPaymentId: "payment-1",
        paymentTransaction: {
          providerPaymentId: "payment-1",
          status: "cancelled",
        },
      })
    ).toBe(true);
  });

  it("mantem pagamento pendente como nao processado", () => {
    expect(
      isPaymentWebhookAlreadyProcessed({
        reservation: {
          id: "reservation-1",
          paymentStatus: "awaiting_payment",
        },
        providerPaymentId: "payment-1",
        paymentTransaction: {
          providerPaymentId: "preference-1",
          status: "awaiting_payment",
        },
      })
    ).toBe(false);
  });
});
