import { describe, expect, it } from "vitest";

import { createHotelRoomPayloadSchema, updateHotelRoomPayloadSchema } from "@/lib/validations/room";

const validRoomPayload = {
  name: "Quarto Standard",
  description: "Quarto confortavel com estrutura completa.",
  imageUrl: "https://cdn.example.test/standard.webp",
  images: [
    {
      url: "https://cdn.example.test/standard.webp",
      alt: "Quarto Standard",
      position: 0,
    },
  ],
  units: 1,
  capacityAdults: 2,
  capacityChildren: 0,
  beds: "1x Cama queen",
  sizeM2: 25,
  amenities: ["Wi-Fi no quarto"],
  isActive: true,
};

describe("hotel room validation", () => {
  it("aceita quarto com uma unidade", () => {
    expect(createHotelRoomPayloadSchema.safeParse(validRoomPayload).success).toBe(true);
  });

  it("aceita quarto com quatro unidades", () => {
    expect(createHotelRoomPayloadSchema.safeParse({ ...validRoomPayload, units: 4 }).success).toBe(
      true
    );
  });

  it("nao aceita unidades zeradas", () => {
    const result = createHotelRoomPayloadSchema.safeParse({ ...validRoomPayload, units: 0 });

    expect(result.success).toBe(false);
  });

  it("nao aceita unidades negativas", () => {
    const result = createHotelRoomPayloadSchema.safeParse({ ...validRoomPayload, units: -1 });

    expect(result.success).toBe(false);
  });

  it("permite editar unidades", () => {
    expect(updateHotelRoomPayloadSchema.safeParse({ units: 2 }).success).toBe(true);
  });
});
