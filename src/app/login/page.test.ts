import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LoginPage markup", () => {
  it("exibe link para solicitação de acesso de donos de hotel", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("Sou dono de hotel");
    expect(source).toContain("Solicitar acesso de hotel");
    expect(source).toContain('href="/cadastro"');
    expect(source).toContain("<LoginForm />");
  });
});
