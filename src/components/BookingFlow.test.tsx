import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BookingFlow } from "@/components/BookingFlow";

describe("BookingFlow", () => {
  it("não renderiza Pix, Boleto nem campos sensíveis de cartão", () => {
    const html = renderToStaticMarkup(
      <BookingFlow hotelId="hotel_123456" hotelName="Hotel LPH" rooms={[]} />
    );

    expect(html).not.toContain("Pix");
    expect(html).not.toContain("Boleto");
    expect(html).not.toContain("CVV");
    expect(html).not.toContain("validade");
    expect(html).not.toContain("número do cartão");
    expect(html).toContain("Consultar disponibilidade");
  });
});
