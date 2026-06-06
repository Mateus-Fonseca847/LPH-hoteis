import { describe, expect, it } from "vitest";

import { normalizeText } from "@/lib/normalize-text";

describe("text normalization", () => {
  it("remove acentos e normaliza caixa para comparacoes de localizacao", () => {
    expect(normalizeText("São Paulo")).toBe("sao paulo");
    expect(normalizeText("Brasília - DF")).toBe("brasilia - df");
    expect(normalizeText("João Pessoa")).toBe("joao pessoa");
  });
});
