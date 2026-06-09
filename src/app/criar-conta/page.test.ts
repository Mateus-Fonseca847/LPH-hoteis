import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SignupPage markup", () => {
  it("renderiza cadastro comum separado da solicitaÃ§Ã£o de hotel", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const formSource = readFileSync(new URL("./SignupForm.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("<SignupForm />");
    expect(pageSource).toContain("Criar conta");
    expect(pageSource).toContain('href="/login"');
    expect(formSource).toContain('fetch("/api/auth/register"');
    expect(formSource).not.toContain("/api/hotel-owner-signup");
  });
});
