import { describe, expect, it } from "vitest";

import { parseCreateReservationPayload } from "@/lib/validations/reservation";

const validPayload = {
  hotelId: "hotel_123456",
  roomId: "room_1234567",
  guestName: "Maria Silva",
  guestEmail: "maria@example.com",
  guestPhone: "11999999999",
  guestDocument: "AB123456",
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  adults: 2,
  children: 1,
  paymentMethod: "pix",
};

describe("createReservationPayloadSchema", () => {
  it("normaliza e aceita payload valido de reserva", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      guestEmail: " MARIA@EXAMPLE.COM ",
      guestName: "  Maria   Silva  ",
      guestDocument: " ab123456 ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guestEmail).toBe("maria@example.com");
      expect(result.data.guestName).toBe("Maria Silva");
      expect(result.data.guestDocument).toBe("AB123456");
    }
  });

  it("rejeita hospede, documento e forma de pagamento invalidos", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      guestEmail: "sem-email",
      guestDocument: "11111111111",
      paymentMethod: "dinheiro",
    });

    expect(result.success).toBe(false);
  });

  it("rejeita datas fora do formato esperado", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      checkIn: "10/07/2026",
    });

    expect(result).toEqual({
      success: false,
      error: "Check-in inválida.",
    });
  });

  it("rejeita ocupacao fora dos limites", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      adults: 0,
      children: 11,
    });

    expect(result.success).toBe(false);
  });
});
