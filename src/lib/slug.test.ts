import { describe, expect, it } from "vitest";

import { generateSlugFromName } from "@/lib/slug";

describe("generateSlugFromName", () => {
  it("normaliza nome com acentos", () => {
    expect(generateSlugFromName("Pousada Casa Maré")).toBe("pousada-casa-mare");
  });

  it("remove caracteres especiais e hifens duplicados", () => {
    expect(generateSlugFromName("  Hotel & Spa --- LPH!!!  ")).toBe("hotel-spa-lph");
  });
});
