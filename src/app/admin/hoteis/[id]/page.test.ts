import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminHotelDetailPage markup", () => {
  it("carrega edição com autorização, logs e query explícita", () => {
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
    expect(source).toContain("Você não tem permissão para editar este hotel.");
    expect(source).toContain("Hotel não encontrado.");
    expect(source).toContain("Este hotel foi removido ou arquivado.");
    expect(source).toContain(
      "Erro ao carregar hotel. Verifique se as migrations do banco foram aplicadas."
    );
    expect(source).toContain("approveHotelAction");
    expect(source).toContain('user.globalRole === "super_admin" ? approveHotelAction.bind');
    expect(source).toContain('canPublish={user.globalRole === "super_admin"}');
    expect(source).not.toContain("HotelPaymentSettingsForm");
    expect(source).not.toContain("Pagamentos");
    expect(workspaceSource).toContain("IconBackLink");
    expect(workspaceSource).toContain("ariaLabel={backLabel}");
  });
});
