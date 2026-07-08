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
  paymentMethod: "credit_card",
  paymentCardBrand: "visa",
  paymentObservation1: "1234 5678 9012 3456",
  paymentObservation2: "12/30",
  paymentObservation3: "123",
};

describe("createReservationPayloadSchema", () => {
  it("normaliza e aceita payload valido de reserva", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      guestEmail: " MARIA@EXAMPLE.COM ",
      guestName: "  Maria   Silva  ",
      guestDocument: " ab123456 ",
      paymentObservation1: "  1234 5678 9012 3456  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guestEmail).toBe("maria@example.com");
      expect(result.data.guestName).toBe("Maria Silva");
      expect(result.data.guestDocument).toBe("AB123456");
      expect(result.data.paymentMethod).toBe("credit_card");
      expect(result.data.paymentCardBrand).toBe("visa");
      expect(result.data.paymentObservation1).toBe("1234 5678 9012 3456");
    }
  });

  it("rejeita hóspede, documento e forma de pagamento inválidos", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      guestEmail: "sem-email",
      guestDocument: "11111111111",
      paymentMethod: "dinheiro",
      paymentCardBrand: "desconhecida",
    });

    expect(result.success).toBe(false);
  });

  it("aceita débito e rejeita bandeira ausente", () => {
    expect(
      parseCreateReservationPayload({
        ...validPayload,
        paymentMethod: "debit_card",
        paymentCardBrand: "mastercard",
      }).success
    ).toBe(true);

    expect(
      parseCreateReservationPayload({
        ...validPayload,
        paymentCardBrand: "",
      }).success
    ).toBe(false);
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

  it("rejeita dados de cartao fora do formato esperado", () => {
    expect(
      parseCreateReservationPayload({
        ...validPayload,
        paymentObservation1: "1234567890123456",
      })
    ).toEqual({
      success: false,
      error: "Número do cartão inválido.",
    });

    expect(
      parseCreateReservationPayload({
        ...validPayload,
        paymentObservation2: "13/30",
      }).success
    ).toBe(false);

    expect(
      parseCreateReservationPayload({
        ...validPayload,
        paymentObservation3: "1234",
      }).success
    ).toBe(false);
  });

  it("rejeita ocupação fora dos limites", () => {
    const result = parseCreateReservationPayload({
      ...validPayload,
      adults: 0,
      children: 11,
    });

    expect(result.success).toBe(false);
  });
});
