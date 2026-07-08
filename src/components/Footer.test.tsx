import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Footer navigation", () => {
  it("mantem os links principais e envia Contato para o WhatsApp da LPH", () => {
    const source = readFileSync(new URL("./Footer.tsx", import.meta.url), "utf8");

    expect(source).toContain('href="#top"');
    expect(source).toContain('href="#journey"');
    expect(source).toContain('href="#destinations"');
    expect(source).toContain('href="https://wa.me/5524981128252"');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
