import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMercadoPagoPayment } from "@/lib/payments/mercado-pago";
import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";
import { prisma } from "@/lib/prisma";
import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";

vi.mock("@/lib/payments/mercado-pago", () => ({
  getMercadoPagoPayment: vi.fn(),
  searchMercadoPagoPaymentByReservationId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    paymentReconciliationLog: {
      create: vi.fn(),
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
vi.mock("@/lib/security/encryption", () => ({
  decryptSecret: vi.fn(() => "hotel-token"),
}));

const context = {
  id: "reservation-1",
  hotelId: "hotel-1",
  paymentProvider: "mercado_pago",
  providerPaymentId: "preference-1",
  paymentStatus: "awaiting_payment",
  totalPriceCents: 75000,
  currency: "BRL",
  paymentTransaction: {
    id: "transaction-1",
    provider: "mercado_pago",
    providerPaymentId: "preference-1",
    status: "awaiting_payment",
    grossAmountCents: 75000,
    currency: "BRL",
  },
  hotel: {
    paymentSettings: {
      encryptedAccessToken: "encrypted",
    },
  },
};

function payment(status: string) {
  return {
    id: "12345",
    status,
    statusDetail: undefined,
    reservationId: "reservation-1",
    paymentMethodId: "pix",
    paymentTypeId: "bank_transfer",
    totalPriceCents: 75000,
    currency: "BRL",
  };
}

describe("Mercado Pago reconciliation", () => {
  beforeEach(() => {
    vi.mocked(getMercadoPagoPayment).mockReset();
    vi.mocked(prisma.reservation.findUnique).mockReset();
    vi.mocked(prisma.reservation.findFirst).mockReset();
    vi.mocked(prisma.paymentReconciliationLog.create).mockReset();
    vi.mocked(confirmPaidReservation).mockReset();
    vi.mocked(closeUnpaidReservation).mockReset();
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(context as never);
  });

  it("approved confirma reserva", async () => {
    vi.mocked(getMercadoPagoPayment).mockResolvedValue(payment("approved"));
    vi.mocked(confirmPaidReservation).mockResolvedValue({
      reservationId: "reservation-1",
      confirmed: false,
    });

    await syncMercadoPagoPayment({
      paymentId: "12345",
      source: "manual",
    });

    expect(confirmPaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      providerPaymentId: "12345",
      paymentMethod: "bank_transfer",
    });
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
    expect(prisma.paymentReconciliationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          remoteStatus: "approved",
          success: true,
        }),
      })
    );
  });

  it("rejected marca falha conforme regra atual", async () => {
    vi.mocked(getMercadoPagoPayment).mockResolvedValue(payment("rejected"));

    await syncMercadoPagoPayment({
      paymentId: "12345",
      source: "manual",
    });

    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "payment_failed",
      providerPaymentId: "12345",
    });
  });

  it("cancelled marca cancelada conforme regra atual", async () => {
    vi.mocked(getMercadoPagoPayment).mockResolvedValue(payment("cancelled"));

    await syncMercadoPagoPayment({
      paymentId: "12345",
      source: "manual",
    });

    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "cancelled",
      providerPaymentId: "12345",
    });
  });

  it("chamada duplicada nao duplica efeitos", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...context,
      providerPaymentId: "12345",
      paymentStatus: "paid",
      paymentTransaction: {
        ...context.paymentTransaction,
        providerPaymentId: "12345",
        status: "paid",
      },
    } as never);
    vi.mocked(getMercadoPagoPayment).mockResolvedValue(payment("approved"));

    await syncMercadoPagoPayment({
      paymentId: "12345",
      source: "manual",
    });

    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("erro da API nao corrompe reserva", async () => {
    vi.mocked(getMercadoPagoPayment).mockRejectedValue(new Error("api down"));

    await expect(
      syncMercadoPagoPayment({
        paymentId: "12345",
        source: "manual",
      })
    ).rejects.toThrow("api down");

    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
    expect(prisma.paymentReconciliationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          success: false,
          error: "api down",
        }),
      })
    );
  });
});
