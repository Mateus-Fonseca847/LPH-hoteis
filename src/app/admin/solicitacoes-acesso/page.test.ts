import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminSignupRequestsPage markup", () => {
  it("restringe solicitações a super_admin e lista estados", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const formSource = readFileSync(new URL("./ReviewRequestForm.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain('requireAdminRouteSession("/admin/solicitacoes-acesso")');
    expect(pageSource).toContain('user.globalRole !== "super_admin"');
    expect(pageSource).toContain("Solicitações de acesso");
    expect(pageSource).toContain("Nenhuma solicitação pendente.");
    expect(pageSource).toContain("Nenhuma solicitação aprovada.");
    expect(pageSource).toContain("Nenhuma solicitação rejeitada.");
    expect(pageSource).toContain("CNPJ do hotel");
    expect(pageSource).toContain("formatCnpj(request.hotelDocument)");
    expect(pageSource).not.toContain("passwordHash: true");
    expect(formSource).toContain("Aprovar e criar hotel_admin");
    expect(formSource).toContain("Rejeitar solicitação");
  });
});
