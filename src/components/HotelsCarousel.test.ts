import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelsCarousel", () => {
  const source = readFileSync(new URL("./HotelsCarousel.tsx", import.meta.url), "utf8");

  it("nao duplica visualmente os hoteis para animar o carrossel", () => {
    expect(source).not.toContain("[...hotels, ...hotels]");
    expect(source).toContain("hotels.map");
  });
});
