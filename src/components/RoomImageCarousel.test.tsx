import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getNextRoomImageIndex, RoomImageCarousel } from "@/components/RoomImageCarousel";

describe("RoomImageCarousel", () => {
  it("renderiza imagem única sem setas", () => {
    const html = renderToStaticMarkup(
      <RoomImageCarousel
        images={[{ id: "image-1", url: "https://cdn.example.test/suite.webp", alt: "Suíte" }]}
        roomName="Suíte"
        sizes="280px"
      />
    );

    expect(html).toContain("Suíte");
    expect(html).not.toContain("Imagem anterior");
    expect(html).not.toContain("Próxima imagem");
  });

  it("renderiza carrossel com setas e indicador para múltiplas imagens", () => {
    const html = renderToStaticMarkup(
      <RoomImageCarousel
        images={[
          { id: "image-1", url: "https://cdn.example.test/suite-1.webp", alt: "Quarto vista mar" },
          { id: "image-2", url: "https://cdn.example.test/suite-2.webp", alt: "Banheiro" },
        ]}
        roomName="Suíte"
        sizes="280px"
      />
    );

    expect(html).toContain("Imagem anterior de Suíte");
    expect(html).toContain("Próxima imagem de Suíte");
    expect(html).toContain("1/2");
    expect(html).toContain("Quarto vista mar");
  });

  it("calcula próximo e anterior com loop", () => {
    expect(getNextRoomImageIndex(0, 3, 1)).toBe(1);
    expect(getNextRoomImageIndex(2, 3, 1)).toBe(0);
    expect(getNextRoomImageIndex(0, 3, -1)).toBe(2);
  });

  it("usa imageUrl legado como fallback", () => {
    const html = renderToStaticMarkup(
      <RoomImageCarousel
        images={[]}
        fallbackImageUrl="https://cdn.example.test/legado.webp"
        roomName="Standard"
        sizes="280px"
      />
    );

    expect(html).toContain("Imagem do quarto Standard");
    expect(html).not.toContain("Próxima imagem");
  });
});
