import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminHotelDetailPage markup", () => {
  it("carrega edição com autorização e query explícita sem exibir histórico", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const workspaceSource = readFileSync(
      new URL("../HotelManagementWorkspace.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("HotelManagementWorkspace");
    expect(source).toContain("requireHotelEditAccess(user.id, id)");
    expect(source).toContain("[admin/hoteis/edit/load]");
    expect(source).toContain("hasHotelArchiveFields");
    expect(source).toContain("select: {");
    expect(source).toContain("supportsArchiveFields ? { isArchived: true } : {}");
    expect(source).toContain("let activeRatesCount = 0");
    expect(source).toContain("let futureAvailabilityCount = 0");
    expect(source).toContain("let approvalSubmissionsCount = 0");
    expect(source).toContain("hotel.rooms.filter");
    expect(source).toContain("hotel.experiences.filter");
    expect(source).toContain("Você não tem permissão para editar este hotel.");
    expect(source).toContain("Hotel não encontrado.");
    expect(source).toContain("Este hotel foi removido ou arquivado.");
    expect(source).toContain("Erro de schema do banco. Aplique as migrations.");
    expect(source).toContain("Não foi possível carregar este hotel.");
    expect(source).toContain('href="/admin/hoteis"');
    expect(source).toContain("approveHotelAction");
    expect(source).toContain('user.globalRole === "super_admin" ? approveHotelAction.bind');
    expect(source).toContain('canPublish={user.globalRole === "super_admin"}');
    expect(source).not.toContain("HotelPaymentSettingsForm");
    expect(source).not.toContain("Pagamentos");
    expect(source).not.toContain("Histórico de alterações");
    expect(source).not.toContain("auditLogs:");
    expect(source).not.toContain("footerSlot=");
    expect(source).not.toContain("findUniqueOrThrow");
    expect(workspaceSource).toContain("IconBackLink");
    expect(workspaceSource).toContain("ariaLabel={backLabel}");
  });
});
