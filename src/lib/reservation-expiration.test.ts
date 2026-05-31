import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  expirePendingReservations,
  getBookingPaymentExpiresAt,
  getBookingPaymentTtlMinutes,
} from "@/lib/reservation-expiration";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const now = new Date(Date.UTC(2026, 6, 10, 12));
const expiredReservation = {
  id: "reservation-1",
  roomId: "room-1",
  checkIn: new Date(Date.UTC(2026, 6, 20)),
  checkOut: new Date(Date.UTC(2026, 6, 22)),
};

function mockExpirationTransaction(updateCount = 1) {
  const tx = {
    reservation: {
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
    roomAvailability: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    paymentTransaction: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

  return tx;
}

describe("reservation expiration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(prisma.reservation.findMany).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
  });

  it("usa TTL configuravel com fallback seguro", () => {
    vi.stubEnv("BOOKING_PAYMENT_TTL_MINUTES", "45");

    expect(getBookingPaymentTtlMinutes()).toBe(45);
    expect(getBookingPaymentExpiresAt(now)).toEqual(new Date(Date.UTC(2026, 6, 10, 12, 45)));

    vi.stubEnv("BOOKING_PAYMENT_TTL_MINUTES", "valor-invalido");

    expect(getBookingPaymentTtlMinutes()).toBe(30);
  });

  it("reserva awaiting_payment antes do vencimento continua bloqueando disponibilidade", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);

    await expect(
      expirePendingReservations({
        now,
        roomId: "room-1",
        checkIn: "2026-07-20",
        checkOut: "2026-07-22",
      })
    ).resolves.toEqual({ expired: 0, scanned: 0 });

    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "awaiting_payment",
          paymentStatus: "awaiting_payment",
          expiresAt: { lte: now },
        }),
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reserva awaiting_payment expirada libera disponibilidade", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([expiredReservation] as never);
    const tx = mockExpirationTransaction();

    await expect(expirePendingReservations({ now })).resolves.toEqual({
      expired: 1,
      scanned: 1,
    });

    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "expired",
          paymentStatus: "cancelled",
          expiredAt: now,
          availabilityHeld: false,
        }),
      })
    );
    expect(tx.roomAvailability.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { availableUnits: { increment: 1 } },
      })
    );
    expect(tx.paymentTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "cancelled" }),
      })
    );
  });

  it("expiracao duplicada e idempotente", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([expiredReservation] as never);
    const tx = mockExpirationTransaction(0);

    await expect(expirePendingReservations({ now })).resolves.toEqual({
      expired: 0,
      scanned: 1,
    });

    expect(tx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.updateMany).not.toHaveBeenCalled();
  });
});
