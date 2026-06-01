import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/reservas/route";
import { createPayment, resolveHotelPaymentConfiguration } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { expirePendingReservations } from "@/lib/reservation-expiration";

vi.mock("@/lib/payments", () => ({
  createPayment: vi.fn(),
  resolveHotelPaymentConfiguration: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hotelRoom: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/reservation-expiration", () => ({
  expirePendingReservations: vi.fn(),
  getBookingPaymentExpiresAt: vi.fn(() => new Date(Date.UTC(2099, 6, 1, 0, 30))),
}));

const validPayload = {
  hotelId: "hotel_123456",
  roomId: "room_1234567",
  guestName: "Maria Silva",
  guestEmail: "maria@example.com",
  guestPhone: "11999999999",
  guestDocument: "AB123456",
  checkIn: "2099-07-10",
  checkOut: "2099-07-12",
  adults: 2,
  children: 1,
  paymentMethod: "pix",
};

const room = {
  id: validPayload.roomId,
  hotelId: validPayload.hotelId,
  name: "Suite Vista Mar",
  isAvailable: true,
  capacity: 3,
  capacityAdults: 2,
  capacityChildren: 1,
  priceFrom: 350,
  hotel: {
    id: validPayload.hotelId,
    name: "LPH Santos",
    slug: "lph-santos",
    isPublished: true,
    paymentSettings: {
      provider: "mercado_pago",
      isEnabled: true,
      encryptedAccessToken: null,
    },
  },
  availability: [
    { date: new Date(Date.UTC(2099, 6, 10)), availableUnits: 2, closed: false },
    { date: new Date(Date.UTC(2099, 6, 11)), availableUnits: 1, closed: false },
  ],
  rates: [
    {
      id: "rate-1",
      name: "Flexivel",
      description: "Tarifa flexivel",
      priceCents: 35000,
      currency: "BRL",
      startDate: new Date(Date.UTC(2099, 6, 1)),
      endDate: new Date(Date.UTC(2099, 6, 31)),
      minNights: 1,
      maxGuests: 3,
      refundable: true,
      breakfastIncluded: true,
      isActive: true,
    },
  ],
};

function createRequest(payload: unknown = validPayload) {
  return new Request("http://localhost/api/reservas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(payload),
  });
}

function mockReservationTransaction(options?: { availabilityCount?: number }) {
  const tx = {
    roomAvailability: {
      updateMany: vi.fn().mockResolvedValue({
        count: options?.availabilityCount ?? 2,
      }),
    },
    reservation: {
      create: vi.fn().mockImplementation(({ data }: { data: { id: string } }) => ({
        id: data.id,
        status: "pending",
        createdAt: new Date(Date.UTC(2099, 6, 1)),
      })),
      updateMany: vi.fn().mockResolvedValue({
        count: 1,
      }),
    },
    paymentTransaction: {
      create: vi.fn().mockResolvedValue({
        id: "payment-transaction-1",
      }),
      updateMany: vi.fn().mockResolvedValue({
        count: 1,
      }),
    },
  };

  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

  return tx;
}

describe("POST /api/reservas", () => {
  beforeEach(() => {
    vi.mocked(prisma.hotelRoom.findFirst).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(createPayment).mockReset();
    vi.mocked(resolveHotelPaymentConfiguration).mockReset();
    vi.mocked(expirePendingReservations).mockReset();

    vi.mocked(prisma.hotelRoom.findFirst).mockResolvedValue(room as never);
    vi.mocked(resolveHotelPaymentConfiguration).mockReturnValue({
      provider: "mercado_pago",
      accessToken: "fake-token",
    });
    vi.mocked(createPayment).mockResolvedValue({
      provider: "mercado_pago",
      providerPaymentId: "payment-1",
      checkoutUrl: "https://checkout.example.test",
      status: "awaiting_payment",
    });
    vi.mocked(expirePendingReservations).mockResolvedValue({
      expired: 0,
      scanned: 0,
    });
  });

  it("cria reserva pendente, segura disponibilidade e inicia pagamento com mocks", async () => {
    const tx = mockReservationTransaction();

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(tx.roomAvailability.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          availableUnits: {
            decrement: 1,
          },
        },
      })
    );
    expect(tx.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending",
          paymentStatus: "pending",
          expiresAt: new Date(Date.UTC(2099, 6, 1, 0, 30)),
          availabilityHeld: true,
          totalPriceCents: 70000,
        }),
      })
    );
    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "awaiting_payment",
          paymentStatus: "awaiting_payment",
          providerPaymentId: "payment-1",
        }),
      })
    );
    expect(tx.paymentTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "awaiting_payment",
          providerPaymentId: "payment-1",
        }),
      })
    );
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "mercado_pago",
        method: "pix",
        reservationId: expect.any(String),
        notificationUrl: "http://localhost:3000/api/mercado-pago/webhook",
      })
    );
  });

  it("rejeita check-out igual ou anterior ao check-in", async () => {
    const response = await POST(
      createRequest({
        ...validPayload,
        checkOut: validPayload.checkIn,
      })
    );

    expect(response.status).toBe(400);
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("rejeita hotel despublicado ou inexistente antes de reservar disponibilidade", async () => {
    vi.mocked(prisma.hotelRoom.findFirst).mockResolvedValue(null);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("rejeita quarto inativo ou inexistente antes de reservar disponibilidade", async () => {
    vi.mocked(prisma.hotelRoom.findFirst).mockResolvedValue(null);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("nao cria reserva quando disponibilidade some dentro da transacao", async () => {
    const tx = mockReservationTransaction({
      availabilityCount: 1,
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(tx.reservation.create).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });
});
