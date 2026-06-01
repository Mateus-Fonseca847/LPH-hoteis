import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/internal/reservas/expirar/route";
import { reconcileRecentAwaitingMercadoPagoReservations } from "@/lib/payments/mercado-pago-reconciliation";
import { expirePendingReservations } from "@/lib/reservation-expiration";

vi.mock("@/lib/payments/mercado-pago-reconciliation", () => ({
  reconcileRecentAwaitingMercadoPagoReservations: vi.fn(),
}));

vi.mock("@/lib/reservation-expiration", () => ({
  expirePendingReservations: vi.fn(),
}));

function createRequest(token?: string) {
  return new Request("http://localhost/api/internal/reservas/expirar", {
    method: "POST",
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : undefined,
  });
}

describe("internal reservation expiration route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.mocked(reconcileRecentAwaitingMercadoPagoReservations).mockReset();
    vi.mocked(expirePendingReservations).mockReset();
  });

  it("recusa chamadas quando token interno nao esta configurado", async () => {
    const response = await POST(createRequest("token"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "configuration_error",
      error: "Token interno nao configurado.",
    });
    expect(reconcileRecentAwaitingMercadoPagoReservations).not.toHaveBeenCalled();
    expect(expirePendingReservations).not.toHaveBeenCalled();
  });

  it("recusa chamadas sem token", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "token-correto");

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: "unauthorized", error: "Nao autorizado." });
    expect(reconcileRecentAwaitingMercadoPagoReservations).not.toHaveBeenCalled();
    expect(expirePendingReservations).not.toHaveBeenCalled();
  });

  it("recusa chamadas com token invalido", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "token-correto");

    const response = await POST(createRequest("token-errado"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: "unauthorized", error: "Nao autorizado." });
    expect(reconcileRecentAwaitingMercadoPagoReservations).not.toHaveBeenCalled();
    expect(expirePendingReservations).not.toHaveBeenCalled();
  });

  it("executa reconciliacao e expiracao com bearer token valido", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "token-correto");
    vi.mocked(reconcileRecentAwaitingMercadoPagoReservations).mockResolvedValue({
      scanned: 2,
      reconciled: 1,
      failed: 0,
    });
    vi.mocked(expirePendingReservations).mockResolvedValue({
      scanned: 3,
      expired: 2,
    });

    const response = await POST(createRequest("token-correto"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      scanned: 3,
      expired: 2,
      reconciliation: {
        scanned: 2,
        reconciled: 1,
        failed: 0,
      },
    });
    expect(console.info).toHaveBeenCalledWith("[reservation-maintenance] Rotina executada.", {
      reconciliation: {
        scanned: 2,
        reconciled: 1,
        failed: 0,
      },
      expiration: {
        scanned: 3,
        expired: 2,
      },
    });
  });

  it("retorna contadores zerados quando nao ha reservas vencidas", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "token-correto");
    vi.mocked(reconcileRecentAwaitingMercadoPagoReservations).mockResolvedValue({
      scanned: 0,
      reconciled: 0,
      failed: 0,
    });
    vi.mocked(expirePendingReservations).mockResolvedValue({
      scanned: 0,
      expired: 0,
    });

    const response = await POST(createRequest("token-correto"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      scanned: 0,
      expired: 0,
      reconciliation: {
        scanned: 0,
        reconciled: 0,
        failed: 0,
      },
    });
  });
});
