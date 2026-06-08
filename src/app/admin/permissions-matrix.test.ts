import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("admin permission matrix", () => {
  it("bloqueia usuario comum no shell administrativo", () => {
    const layout = source("./layout.tsx");
    const auth = source("../../lib/auth/index.ts");

    expect(layout).toContain("requireAdminRouteSession()");
    expect(auth).toContain("if (!isAdminUser(user.globalRole))");
    expect(auth).toContain("throw new AdminAccessError");
  });

  it("exibe financeiro, auditoria e solicitacoes somente para super_admin no dashboard", () => {
    const page = source("./page.tsx");

    expect(page).toContain("superAdminOnly: true");
    expect(page).toContain('href: "/admin/financeiro"');
    expect(page).toContain('href: "/admin/auditoria"');
    expect(page).toContain('href: "/admin/solicitacoes-acesso"');
    expect(page).toContain("overviewCards.filter((card) => !card.superAdminOnly)");
    expect(page).toContain('const isSuperAdmin = user.globalRole === "super_admin"');
  });

  it("protege rotas diretas exclusivas de super_admin", () => {
    const financeiro = source("./financeiro/page.tsx");
    const auditoria = source("./auditoria/page.tsx");
    const auditoriaDetalhe = source("./auditoria/[id]/page.tsx");
    const solicitacoes = source("./solicitacoes-acesso/page.tsx");
    const administradores = source("./administradores/page.tsx");

    for (const page of [auditoria, auditoriaDetalhe, solicitacoes, administradores]) {
      expect(page).toContain('user.globalRole !== "super_admin"');
      expect(page).toContain("AdminAccessDenied");
    }

    expect(financeiro).toContain('const isSuperAdmin = user.globalRole === "super_admin"');
    expect(financeiro).toContain("if (!isSuperAdmin)");
    expect(financeiro).toContain("AdminAccessDenied");
  });

  it("limita hoteis e reservas de hotel_admin ao HotelPermission", () => {
    const hoteis = source("./hoteis/page.tsx");
    const reservas = source("./reservas/page.tsx");
    const reservaDetalhe = source("./reservas/[id]/page.tsx");

    expect(hoteis).toContain("prisma.hotelPermission");
    expect(hoteis).toContain("userId: user.id");
    expect(reservas).toContain("prisma.hotelPermission.findMany");
    expect(reservas).toContain("scopeWhere");
    expect(reservas).toContain("prisma.reservation.findMany");
    expect(reservaDetalhe).toContain("prisma.hotelPermission.findMany");
    expect(reservaDetalhe).toContain("prisma.reservation.findFirst");
    expect(reservaDetalhe).toContain("notFound()");
  });

  it("mantem actions sensiveis protegidas no servidor", () => {
    const reservaActions = source("./reservas/[id]/actions.ts");
    const reservaOps = source("../../lib/admin/reservation-operations.ts");
    const hotelActions = source("./hoteis/[id]/actions.ts");
    const userActions = source("./users/actions.ts");
    const signupActions = source("./solicitacoes-acesso/actions.ts");

    expect(reservaActions).toContain("requireHotelAdminAccess(user.id, reservation.hotelId)");
    expect(reservaOps).toContain("await requireHotelAdminAccess(userId, hotelId)");
    expect(hotelActions).toContain('user.globalRole !== "super_admin"');
    expect(hotelActions).toContain("Apenas super_admin pode aprovar e publicar");
    expect(userActions).toContain("requireSuperAdminActor");
    expect(userActions).toContain("Apenas super_admin pode criar e vincular hotel_admin.");
    expect(signupActions).toContain('actor.globalRole !== "super_admin"');
  });
});
