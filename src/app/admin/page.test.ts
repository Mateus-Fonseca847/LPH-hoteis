import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminHomePage markup", () => {
  it("inclui o CTA Adicionar hotel e identidade visual dos cards", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("Adicionar hotel");
    expect(source).toContain("/admin/hoteis/novo");
    expect(source).toContain("/admin/solicitacoes-acesso");
    expect(source).toContain("Solicitações de acesso");
    expect(source).toContain("Analise pedidos de donos de hotéis.");
    expect(source).toContain("admin-identity-card");
    expect(source).not.toContain("admin-identity-card__icon");
  });

  it("mostra o card de auditoria de tarifas sem texto acidental", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('title: "Auditoria"');
    expect(source).toContain("Consulte altera");
    expect(source).toContain("tarifas dos hot");
    expect(source).toContain('action: "Abrir auditoria"');
    expect(source).not.toContain("npm cache clean --force");
  });
});
