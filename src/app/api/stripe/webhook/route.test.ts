import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/stripe/webhook/route";
import { prisma } from "@/lib/prisma";
import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/reservation-confirmation", () => ({
  closeUnpaidReservation: vi.fn(),
  confirmPaidReservation: vi.fn(),
}));
vi.mock("@/lib/reservations", () => ({
  sendGuestReservationEmail: vi.fn(),
  sendHotelReservationEmail: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
}));

const constructEvent = vi.fn();

const paidReservation = {
  id: "reservation-1",
  status: "awaiting_payment",
  paymentStatus: "awaiting_payment",
};

const reservationWithEmailData = {
  id: "reservation-1",
  guestName: "Maria Silva",
  guestEmail: "maria@example.test",
  guestPhone: "11999999999",
  guestDocument: "AB123456",
  checkIn: new Date(Date.UTC(2099, 6, 10)),
  checkOut: new Date(Date.UTC(2099, 6, 12)),
  adults: 2,
  children: 1,
  nights: 2,
  nightlyPriceCents: 35000,
  totalPriceCents: 70000,
  hotel: {
    email: "hotel@example.test",
    name: "Hotel LPH",
  },
  room: {
    name: "Suíte Vista Mar",
  },
};

function createStripeRequest() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": "test-signature",
    },
    body: "{}",
  });
}

describe("Stripe legacy webhook", () => {
  beforeEach(() => {
    constructEvent.mockReset();
    vi.mocked(getStripe).mockReset();
    vi.mocked(getStripeWebhookSecret).mockReset();
    vi.mocked(prisma.reservation.findUnique).mockReset();
    vi.mocked(confirmPaidReservation).mockReset();
    vi.mocked(closeUnpaidReservation).mockReset();
    vi.mocked(sendGuestReservationEmail).mockReset();
    vi.mocked(sendHotelReservationEmail).mockReset();

    vi.mocked(getStripe).mockReturnValue({
      webhooks: {
        constructEvent,
      },
    } as never);
    vi.mocked(getStripeWebhookSecret).mockReturnValue("whsec_test");
  });

  it("rejeita webhook legado sem assinatura antes de consultar Stripe", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("confirma checkout pago e envia e-mails usando mocks", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          payment_intent: "pi_test",
          metadata: {
            reservationId: "reservation-1",
          },
        },
      },
    });
    vi.mocked(prisma.reservation.findUnique)
      .mockResolvedValueOnce(paidReservation as never)
      .mockResolvedValueOnce(reservationWithEmailData as never);
    vi.mocked(confirmPaidReservation).mockResolvedValue({
      reservationId: "reservation-1",
      confirmed: true,
    });

    const response = await POST(createStripeRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      stripeCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_test",
    });
    expect(sendHotelReservationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "reservation-1",
        guestEmail: "maria@example.test",
      })
    );
    expect(sendGuestReservationEmail).toHaveBeenCalled();
  });

  it("não confirma novamente checkout pago duplicado", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          metadata: {
            reservationId: "reservation-1",
          },
        },
      },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...paidReservation,
      paymentStatus: "paid",
    } as never);

    const response = await POST(createStripeRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
    expect(sendHotelReservationEmail).not.toHaveBeenCalled();
  });

  it("fecha reserva não paga quando checkout legado expira", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_expired",
          metadata: {
            reservationId: "reservation-1",
          },
        },
      },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(paidReservation as never);

    const response = await POST(createStripeRequest());

    expect(response.status).toBe(200);
    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "cancelled",
      stripeCheckoutSessionId: "cs_expired",
    });
  });

  it("nao encerra novamente checkout legado expirado repetido", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_expired",
          metadata: {
            reservationId: "reservation-1",
          },
        },
      },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...paidReservation,
      paymentStatus: "cancelled",
      stripeCheckoutSessionId: "cs_expired",
    } as never);

    const response = await POST(createStripeRequest());

    expect(response.status).toBe(200);
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
    expect(confirmPaidReservation).not.toHaveBeenCalled();
  });

  it("fecha reserva não paga quando payment intent legado falha", async () => {
    constructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed",
          metadata: {
            reservationId: "reservation-1",
          },
        },
      },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(paidReservation as never);

    const response = await POST(createStripeRequest());

    expect(response.status).toBe(200);
    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "payment_failed",
      stripePaymentIntentId: "pi_failed",
    });
  });

  it("nao encerra novamente payment intent legado falho repetido", async () => {
    constructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed",
          metadata: {
            reservationId: "reservation-1",
          },
        },
      },
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...paidReservation,
      paymentStatus: "payment_failed",
      stripePaymentIntentId: "pi_failed",
    } as never);

    const response = await POST(createStripeRequest());

    expect(response.status).toBe(200);
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
    expect(confirmPaidReservation).not.toHaveBeenCalled();
  });
});
