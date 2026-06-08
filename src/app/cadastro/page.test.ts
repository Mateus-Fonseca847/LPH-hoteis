import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cadastro hotel owner signup markup", () => {
  it("usa o fluxo público de solicitação pendente", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const formSource = readFileSync(new URL("./CadastroForm.tsx", import.meta.url), "utf8");
    const routeSource = readFileSync(
      new URL("../api/hotel-owner-signup/route.ts", import.meta.url),
      "utf8"
    );

    expect(pageSource).toContain("Solicitar acesso de hotel");
    expect(formSource).toContain("/api/hotel-owner-signup");
    expect(formSource).toContain("Solicitação enviada com sucesso");
    expect(formSource).toContain("O acesso administrativo será liberado somente após aprovação");
    expect(formSource).not.toContain("/api/auth/register");
    expect(formSource).not.toContain("password");
    expect(routeSource).not.toContain("setAuthSessionCookie");
  });
});
