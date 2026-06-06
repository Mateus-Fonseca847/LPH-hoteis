import { beforeEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "@/lib/errors/app-error";
import { sendTransactionalEmail } from "@/lib/email";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";

vi.mock("@/lib/email", () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/hotel-amenities", () => ({
  getCanonicalAmenityLabel: (label: string) => label,
}));

const input = {
  hotelEmail: "reservas@hotel.test",
  hotelName: "Hotel LPH",
  roomName: "Suite Premium",
  guestName: "Maria Silva",
  guestEmail: "maria@example.test",
  guestPhone: "11999999999",
  checkIn: new Date(Date.UTC(2099, 6, 10)),
  checkOut: new Date(Date.UTC(2099, 6, 12)),
  adults: 2,
  children: 0,
  nights: 2,
  nightlyPriceCents: 35000,
  totalPriceCents: 70000,
  reservationId: "reservation-1",
  paymentMethod: "credit_card",
  paymentCardBrand: "visa",
  paymentObservation1: "1234 5678 9012 3456",
  paymentObservation2: "12/30",
  paymentObservation3: "123",
};

describe("sendHotelReservationEmail", () => {
  beforeEach(() => {
    vi.mocked(sendTransactionalEmail).mockReset();
  });

  it("envia a reserva para o e-mail de contato do hotel", async () => {
    await sendHotelReservationEmail(input);

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "reservas@hotel.test",
        subject: expect.stringContaining("Hotel LPH"),
        text: expect.stringContaining("Observações sobre pagamento"),
        html: expect.stringContaining("Visa"),
      })
    );
  });

  it("não envia a reserva quando o hotel não tem e-mail válido", async () => {
    await expect(
      sendHotelReservationEmail({
        ...input,
        hotelEmail: "inválido",
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});

describe("sendGuestReservationEmail", () => {
  beforeEach(() => {
    vi.mocked(sendTransactionalEmail).mockReset();
  });

  it("envia paymentObservation1, 2 e 3 no e-mail de confirmação do cliente", async () => {
    await sendGuestReservationEmail(input);

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "maria@example.test",
        text: expect.stringContaining("Número do cartão: 1234 5678 9012 3456"),
        html: expect.stringContaining("CVV"),
      })
    );
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Data de validade: 12/30"),
        html: expect.stringContaining("123"),
      })
    );
  });

  it("renderiza paymentObservation1, 2 e 3 mesmo quando não foram informadas", async () => {
    await sendGuestReservationEmail({
      ...input,
      paymentObservation1: "",
      paymentObservation2: "",
      paymentObservation3: "",
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Número do cartão: Não informada"),
        html: expect.stringContaining("Data de validade"),
      })
    );
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("CVV"),
      })
    );
  });
});
