import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BookingFlow } from "@/components/BookingFlow";
import { getCompatibleRoomAvailabilityResults } from "@/lib/availability-results";

describe("BookingFlow", () => {
  it("não renderiza Pix ou Boleto e permite enviar os campos do cartão como observações", () => {
    const html = renderToStaticMarkup(
      <BookingFlow hotelId="hotel_123456" hotelName="Hotel LPH" rooms={[]} />
    );

    expect(html).not.toContain("Pix");
    expect(html).not.toContain("Boleto");
    expect(html).toContain("CVV");
    expect(html).toContain("Data de validade");
    expect(html).toContain("cart");
    expect(html).toContain("Consultar disponibilidade");
  });

  it("usa o carrossel de imagens do quarto na etapa de escolha", () => {
    const source = readFileSync(new URL("./BookingFlow.tsx", import.meta.url), "utf8");

    expect(source).toContain("RoomImageCarousel");
    expect(source).toContain("images={room.images}");
    expect(source).toContain("fallbackImageUrl={room.imageUrl}");
    expect(source).toContain("`${room.sizeM2} m²`");
    expect(source).not.toContain(String.fromCharCode(109, 194, 178));
  });

  it("recebe quarto sem cadastro de disponibilidade como disponivel para reserva", () => {
    const results = getCompatibleRoomAvailabilityResults({
      rooms: [
        {
          id: "room-available-without-grid",
          name: "Suite livre",
          description: "Suite livre",
          imageUrl: "/suite.webp",
          capacity: 2,
          units: 1,
          capacityAdults: 2,
          capacityChildren: 0,
          beds: "Queen",
          sizeM2: 30,
          size: "30m2",
          amenities: [],
          lowestActiveRateCents: 30000,
          publicAvailabilityStatus: "unknown",
          availability: [],
          rates: [],
        },
      ],
      checkIn: "2099-07-10",
      checkOut: "2099-07-12",
      adults: 2,
      children: 0,
    });

    expect(results[0].availabilityStatus).toBe("available");
    expect(results[0].availabilityLabel).toBe("Disponível");
  });
});
