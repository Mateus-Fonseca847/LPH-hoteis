import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelRoomsSection room units field", () => {
  const source = readFileSync(new URL("./HotelRoomsSection.tsx", import.meta.url), "utf8");

  it("renderiza campo de unidades no formulario compartilhado de criacao e edicao", () => {
    expect(source).toContain("Unidades deste quarto");
    expect(source).toContain('placeholder="Ex.: 4"');
    expect(source).toContain("Informe quantas unidades iguais deste quarto o hotel possui.");
    expect(source).toContain('units: "1"');
    expect(source).toContain("units: String(room.units)");
  });

  it("exibe validacoes claras de quantidade", () => {
    expect(source).toContain("Informe pelo menos 1 unidade.");
    expect(source).toContain("A quantidade de unidades deve ser um número inteiro.");
  });

  it("envia e exibe a quantidade de unidades do quarto", () => {
    expect(source).toContain("units: Number(values.units)");
    expect(source).toContain('{room.units} unidade{room.units > 1 ? "s" : ""}');
  });
});
