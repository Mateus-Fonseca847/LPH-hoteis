import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reservation admin actions source", () => {
  it("valida escopo antes de reconciliar pagamento", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source).toContain("requireAdminRouteSession");
    expect(source).toContain("requireHotelAdminAccess(user.id, reservation.hotelId)");
    expect(source).toContain("syncMercadoPagoPayment");
  });

  it("delega operacoes para helpers protegidos por reserva", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source).toContain("cancelReservationManually");
    expect(source).toContain("rescheduleReservationManually");
    expect(source).toContain("updatePendingReservationPaymentStatusManually");
    expect(source).toContain("userId: user.id");
  });
});
