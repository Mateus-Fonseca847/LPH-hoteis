import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMercadoPagoPayment, getMercadoPagoPayment } from "@/lib/payments/mercado-pago";

const input = {
  provider: "mercado_pago" as const,
  method: "pix" as const,
  reservationId: "reservation-1",
  hotelName: "LPH Recife",
  roomName: "Suíte",
  guestName: "Maria Silva",
  guestEmail: "maria@example.com",
  totalPriceCents: 75000,
  currency: "BRL" as const,
  description: "Duas noites",
  successUrl: "https://example.com/success",
  failureUrl: "https://example.com/failure",
  notificationUrl: "https://example.com/api/mercado-pago/webhook",
};

describe("Mercado Pago integration", () => {
  beforeEach(() => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-fake-de-teste");
    vi.stubEnv("MERCADO_PAGO_SANDBOX", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("inicia checkout usando resposta simulada sem acessar serviço externo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "preference-1",
        sandbox_init_point: "https://sandbox.example.com/checkout",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPayment(input)).resolves.toMatchObject({
      provider: "mercado_pago",
      providerPaymentId: "preference-1",
      checkoutUrl: "https://sandbox.example.com/checkout",
      status: "awaiting_payment",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-fake-de-teste");
  });

  it("confirma status aprovado consultando resposta simulada do provedor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 12345,
          status: "approved",
          external_reference: "reservation-1",
          payment_method_id: "pix",
          payment_type_id: "bank_transfer",
          transaction_amount: 750,
          currency_id: "BRL",
        }),
      })
    );

    await expect(getMercadoPagoPayment("12345")).resolves.toEqual({
      id: "12345",
      status: "approved",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });
  });

  it("rejeita retorno do provedor sem valor verificável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 12345,
          status: "approved",
          external_reference: "reservation-1",
          currency_id: "BRL",
        }),
      })
    );

    await expect(getMercadoPagoPayment("12345")).rejects.toThrow(
      "Valor do pagamento inválido no Mercado Pago."
    );
  });
});
