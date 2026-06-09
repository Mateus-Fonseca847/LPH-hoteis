import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LoginPage markup", () => {
  it("exibe cadastro comum e solicitaÃ§Ã£o de hotel em fluxos separados", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("Criar conta");
    expect(source).toContain('href="/criar-conta"');
    expect(source).toContain("Solicitar acesso de hotel");
    expect(source).toContain('href="/cadastro"');
    expect(source).not.toContain("Sou dono de hotel");
    expect(source).toContain("<LoginForm />");
  });
});
