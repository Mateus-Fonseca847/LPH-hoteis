import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminHomePage markup", () => {
  it("inclui o CTA Adicionar hotel e identidade visual dos cards", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("Adicionar hotel");
    expect(source).toContain("/admin/hoteis/novo");
    expect(source).toContain("admin-identity-card");
    expect(source).not.toContain("admin-identity-card__icon");
  });
});
