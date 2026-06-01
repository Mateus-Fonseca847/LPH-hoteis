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
    vi.mocked(reconcileRecentAwaitingMercadoPagoReservations).mockReset();
    vi.mocked(expirePendingReservations).mockReset();
  });

  it("recusa chamadas quando token interno nao esta configurado", async () => {
    const response = await POST(createRequest("token"));

    expect(response.status).toBe(400);
    expect(reconcileRecentAwaitingMercadoPagoReservations).not.toHaveBeenCalled();
    expect(expirePendingReservations).not.toHaveBeenCalled();
  });

  it("recusa chamadas sem token valido", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "token-correto");

    const response = await POST(createRequest("token-errado"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "NÃ£o autorizado." });
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
      scanned: 3,
      expired: 2,
      reconciliation: {
        scanned: 2,
        reconciled: 1,
        failed: 0,
      },
    });
  });
});
