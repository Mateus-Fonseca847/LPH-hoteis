import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mercado-pago/webhook/route";
import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";

vi.mock("@/lib/payments/mercado-pago-reconciliation", () => ({
  syncMercadoPagoPayment: vi.fn(),
}));

const paymentId = "12345";
const secret = "segredo-fake-webhook";

function createWebhookRequest(overrides: { signature?: string } = {}) {
  const requestId = "request-1";
  const timestamp = "1742505638683";
  const signature =
    overrides.signature ??
    createHmac("sha256", secret)
      .update(`id:${paymentId};request-id:${requestId};ts:${timestamp};`)
      .digest("hex");

  return new Request(`http://localhost/api/mercado-pago/webhook?data.id=${paymentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-signature": `ts=${timestamp},v1=${signature}`,
    },
    body: JSON.stringify({
      type: "payment",
      action: "payment.updated",
      data: {
        id: paymentId,
      },
    }),
  });
}

describe("Mercado Pago webhook", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMENT_WEBHOOK_SECRET", secret);
    vi.mocked(syncMercadoPagoPayment).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("valida assinatura e delega a conciliacao central", async () => {
    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(syncMercadoPagoPayment).toHaveBeenCalledWith({
      paymentId,
      source: "webhook",
    });
  });

  it("rejeita assinatura invalida antes de conciliar", async () => {
    const response = await POST(createWebhookRequest({ signature: "assinatura-invalida" }));

    expect(response.status).toBe(400);
    expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
  });
});
