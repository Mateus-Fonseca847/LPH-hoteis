import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BookingFlow } from "@/components/BookingFlow";

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
});
