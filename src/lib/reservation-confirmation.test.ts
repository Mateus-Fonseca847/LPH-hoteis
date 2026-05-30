import { beforeEach, describe, expect, it, vi } from "vitest";

import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const transaction = vi.mocked(prisma.$transaction);
const reservation = {
  id: "reservation-1",
  roomId: "room-1",
  checkIn: new Date(Date.UTC(2026, 6, 10)),
  checkOut: new Date(Date.UTC(2026, 6, 12)),
  status: "awaiting_payment",
  paymentStatus: "awaiting_payment",
  availabilityHeld: true,
  hotelId: "hotel-1",
  paymentProvider: "mercado_pago",
  paymentMethod: "pix",
  totalPriceCents: 120000,
  currency: "BRL",
  paymentTransaction: {
    status: "awaiting_payment",
  },
  room: {
    isActive: true,
    isAvailable: true,
    hotel: {
      isPublished: true,
    },
  },
};

function createTransactionMock(overrides?: {
  reservation?: Partial<typeof reservation> | null;
  availabilityRows?: number;
  availabilityUpdateCount?: number;
  reservationUpdateCount?: number;
}) {
  const tx = {
    reservation: {
      findUnique: vi.fn().mockResolvedValue(
        overrides?.reservation === null
          ? null
          : {
              ...reservation,
              ...overrides?.reservation,
            }
      ),
      updateMany: vi.fn().mockResolvedValue({
        count: overrides?.reservationUpdateCount ?? 1,
      }),
    },
    roomAvailability: {
      count: vi.fn().mockResolvedValue(overrides?.availabilityRows ?? 2),
      updateMany: vi.fn().mockResolvedValue({
        count: overrides?.availabilityUpdateCount ?? 2,
      }),
    },
    paymentTransaction: {
      upsert: vi.fn().mockResolvedValue({
        id: "payment-transaction-1",
      }),
    },
  };

  transaction.mockImplementation(async (callback) => callback(tx as never));

  return tx;
}

describe("reservation payment status transitions", () => {
  beforeEach(() => {
    transaction.mockReset();
  });

  it("confirma reserva paga sem baixar disponibilidade novamente quando ja existe hold", async () => {
    const tx = createTransactionMock();

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
        paymentMethod: "pix",
      })
    ).resolves.toEqual({
      reservationId: "reservation-1",
      confirmed: true,
    });

    expect(tx.roomAvailability.count).toHaveBeenCalledTimes(1);
    expect(tx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "confirmed",
          paymentStatus: "paid",
          providerPaymentId: "payment-1",
          availabilityHeld: true,
        }),
      })
    );
    expect(tx.paymentTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          providerPaymentId: "payment-1",
          status: "paid",
        }),
      })
    );
  });

  it("baixa disponibilidade ao confirmar reserva antiga sem hold", async () => {
    const tx = createTransactionMock({
      reservation: {
        availabilityHeld: false,
      },
    });

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
      })
    ).resolves.toMatchObject({
      confirmed: true,
    });

    expect(tx.roomAvailability.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          availableUnits: {
            decrement: 1,
          },
        },
      })
    );
  });

  it("e idempotente para webhook aprovado duplicado", async () => {
    const tx = createTransactionMock({
      reservation: {
        paymentStatus: "paid",
      },
    });

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
      })
    ).resolves.toEqual({
      reservationId: "reservation-1",
      confirmed: false,
    });

    expect(tx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });

  it("não confirma quando a disponibilidade configurada não cobre toda a estadia", async () => {
    createTransactionMock({
      availabilityRows: 1,
    });

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
      })
    ).rejects.toThrow("Quarto indisponível");
  });

  it("não confirma quando o hotel deixa de estar publicado", async () => {
    const tx = createTransactionMock({
      reservation: {
        room: {
          ...reservation.room,
          hotel: {
            isPublished: false,
          },
        },
      },
    });

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
      })
    ).rejects.toThrow("Hospedagem indisponível");

    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });

  it("não confirma reserva cancelada ou falhada mesmo com pagamento aprovado recebido depois", async () => {
    const tx = createTransactionMock({
      reservation: {
        status: "cancelled",
        paymentStatus: "cancelled",
      },
    });

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
      })
    ).rejects.toThrow("Reserva não pode ser confirmada");

    expect(tx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });

  it("não confirma quando o quarto fica inativo antes do webhook aprovado", async () => {
    const tx = createTransactionMock({
      reservation: {
        room: {
          ...reservation.room,
          isActive: false,
        },
      },
    });

    await expect(
      confirmPaidReservation({
        reservationId: "reservation-1",
        providerPaymentId: "payment-1",
      })
    ).rejects.toThrow("Hospedagem indisponível");

    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });

  it("falha ou cancelamento liberam disponibilidade uma unica vez", async () => {
    const tx = createTransactionMock();

    await expect(
      closeUnpaidReservation({
        reservationId: "reservation-1",
        status: "payment_failed",
        providerPaymentId: "payment-1",
      })
    ).resolves.toBe(true);

    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "payment_failed",
          paymentStatus: "payment_failed",
          availabilityHeld: false,
        }),
      })
    );
    expect(tx.roomAvailability.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          availableUnits: {
            increment: 1,
          },
        },
      })
    );
    expect(tx.paymentTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          providerPaymentId: "payment-1",
          status: "payment_failed",
        }),
      })
    );

    const duplicateTx = createTransactionMock({
      reservationUpdateCount: 0,
    });

    await expect(
      closeUnpaidReservation({
        reservationId: "reservation-1",
        status: "payment_failed",
        providerPaymentId: "payment-1",
      })
    ).resolves.toBe(false);
    expect(duplicateTx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(duplicateTx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });

  it("não encerra reserva quando a transação financeira já está paga", async () => {
    const tx = createTransactionMock({
      reservation: {
        paymentTransaction: {
          status: "paid",
        },
      },
    });

    await expect(
      closeUnpaidReservation({
        reservationId: "reservation-1",
        status: "cancelled",
        providerPaymentId: "payment-1",
      })
    ).resolves.toBe(false);

    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });

  it("não encerra nem libera disponibilidade de reserva que já saiu do estado pendente", async () => {
    const tx = createTransactionMock({
      reservation: {
        status: "confirmed",
        paymentStatus: "awaiting_payment",
      },
    });

    await expect(
      closeUnpaidReservation({
        reservationId: "reservation-1",
        status: "cancelled",
        providerPaymentId: "payment-1",
      })
    ).resolves.toBe(false);

    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(tx.roomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.upsert).not.toHaveBeenCalled();
  });
});
