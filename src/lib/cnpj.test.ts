import { describe, expect, it } from "vitest";

import { formatCnpj, isValidCnpj, normalizeCnpj } from "@/lib/cnpj";

describe("cnpj helpers", () => {
  it("normaliza CNPJ removendo máscara", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
  });

  it("formata CNPJ para leitura", () => {
    expect(formatCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("aceita CNPJ válido sem máscara", () => {
    expect(isValidCnpj("12345678000195")).toBe(true);
  });

  it("aceita CNPJ válido com máscara", () => {
    expect(isValidCnpj("12.345.678/0001-95")).toBe(true);
  });

  it("rejeita CNPJ com menos de 14 dígitos", () => {
    expect(isValidCnpj("12.345.678/0001")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("rejeita CNPJ com dígito verificador inválido", () => {
    expect(isValidCnpj("12.345.678/0001-90")).toBe(false);
  });
});
