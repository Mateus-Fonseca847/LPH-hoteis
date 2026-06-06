import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hotel-amenities", () => ({
  getCanonicalAmenityLabel: (label: string) => label,
}));

import { hotels } from "@/data/hotels";
import { isValidHotelContactEmail } from "@/lib/validations/hotel";

describe("development hotel data", () => {
  it("preenche e-mail de contato valido em todos os hoteis de apoio", () => {
    for (const hotel of hotels) {
      expect(isValidHotelContactEmail(hotel.contacts.email)).toBe(true);
    }
  });

  it("usa e-mails @lph.test nos hoteis genericos de teste", () => {
    const genericHotelSlugs = [
      "hotel-teste-paulista",
      "hotel-teste-recife",
      "hotel-teste-salvador",
      "hotel-teste-brasilia",
      "hotel-teste-floripa",
    ];

    for (const slug of genericHotelSlugs) {
      const hotel = hotels.find((item) => item.slug === slug);
      expect(hotel?.contacts.email.endsWith("@lph.test")).toBe(true);
    }
  });
});
