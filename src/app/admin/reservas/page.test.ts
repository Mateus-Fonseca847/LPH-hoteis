import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminReservationsPage markup", () => {
  it("bloqueia usuario comum via requireAdminRouteSession", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('requireAdminRouteSession("/admin/reservas")');
    expect(source).toContain("AdminAccessDenied");
  });

  it("usa escopo global para super_admin e HotelPermission para hotel_admin", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('user.globalRole === "super_admin"');
    expect(source).toContain("prisma.hotelPermission.findMany");
    expect(source).toContain("userId: user.id");
    expect(source).toContain("select: {\n              hotelId: true");
    expect(source).toContain("scopedHotelIds === null\n      ? {}");
    expect(source).toContain("hotelId: {\n            in: scopedHotelIds");
  });

  it("aplica o escopo em listagem, filtros e contadores", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("prisma.reservation.findMany");
    expect(source).toContain("prisma.reservation.count({ where })");
    expect(source).toContain("...scopeWhere");
    expect(source).toContain("hasInvalidHotelFilter");
    expect(source).toContain('hotelId: "__hotel_outside_scope__"');
  });
});
