import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PasswordInput source", () => {
  const source = readFileSync(new URL("./PasswordInput.tsx", import.meta.url), "utf8");

  it("comeca oculto e alterna entre mostrar e ocultar senha", () => {
    expect(source).toContain("useState(false)");
    expect(source).toContain('type={isVisible ? "text" : "password"}');
    expect(source).toContain('"Mostrar senha"');
    expect(source).toContain('"Ocultar senha"');
    expect(source).toContain("setIsVisible((current) => !current)");
  });

  it("mantem props do input para preservar valor, autofill e validacao", () => {
    expect(source).toContain("<input");
    expect(source).toContain("{...props}");
    expect(source).toContain('type="button"');
  });
});
