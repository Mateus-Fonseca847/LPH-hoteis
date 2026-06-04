import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelPage markup", () => {
  it("remove cards extras do hero, mantém estrelas e usa botão de voltar por ícone", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(
      new URL("../../../components/HotelPageActions.tsx", import.meta.url),
      "utf8"
    );

    expect(pageSource).not.toContain("Perfil atualizado");
    expect(pageSource).not.toContain("Informações revisadas");
    expect(pageSource).not.toContain("Consulte datas e viajantes");
    expect(pageSource).not.toContain("hotel-lead");
    expect(pageSource).toContain("hotel-rating-stars");
    expect(pageSource).toContain('ariaLabel="Voltar à lista de hotéis"');
    expect(actionsSource).toContain("Compartilhar");
    expect(actionsSource).toContain("Favoritar");
    expect(actionsSource).toContain("hotel-utility-rating");
  });
});
