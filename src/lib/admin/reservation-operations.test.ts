import { AuthorizationError, ConflictError } from "@/lib/errors/app-error";
import {
  cancelReservationManually,
  confirmReservationManually,
  markReservationPaymentFailed,
  resendReservationConfirmationEmail,
} from "@/lib/admin/reservation-operations";
import { requireHotelAdminAccess } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import {
  closeUnpaidReservation,
  confirmPaidReservation,
  releaseReservationAvailability,
} from "@/lib/reservation-confirmation";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError,
  requireHotelAdminAccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reservationOperationLog: {
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/reservation-confirmation", () => ({
  closeUnpaidReservation: vi.fn(),
  confirmPaidReservation: vi.fn(),
  releaseReservationAvailability: vi.fn(),
}));
vi.mock("@/lib/reservations", () => ({
  sendGuestReservationEmail: vi.fn(),
  sendHotelReservationEmail: vi.fn(),
}));

const reservation = {
  id: "reservation-1",
  hotelId: "hotel-1",
  roomId: "room-1",
  guestName: "Maria Silva",
  guestEmail: "maria@example.test",
  guestPhone: "11999999999",
  guestDocument: null,
  checkIn: new Date(Date.UTC(2099, 1, 1)),
  checkOut: new Date(Date.UTC(2099, 1, 3)),
  adults: 2,
  children: 0,
  nights: 2,
  nightlyPriceCents: 30000,
  totalPriceCents: 60000,
  status: "awaiting_payment",
  paymentStatus: "awaiting_payment",
  paymentMethod: "pix",
  providerPaymentId: "preference-1",
  hotel: {
    email: "hotel@example.test",
    name: "Hotel LPH",
  },
  room: {
    name: "Suite",
  },
  paymentTransaction: {
    status: "awaiting_payment",
    providerPaymentId: "preference-1",
  },
};

function mockReservation(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
    ...reservation,
    ...overrides,
  } as never);
}

describe("reservation admin operations", () => {
  beforeEach(() => {
    vi.mocked(requireHotelAdminAccess).mockReset().mockResolvedValue({
      globalRole: "super_admin",
      hotelRole: null,
    });
    vi.mocked(prisma.reservation.findUnique).mockReset();
    vi.mocked(prisma.reservation.update).mockReset();
    vi.mocked(prisma.reservationOperationLog.create).mockReset();
    vi.mocked(closeUnpaidReservation).mockReset();
    vi.mocked(confirmPaidReservation).mockReset();
    vi.mocked(releaseReservationAvailability).mockReset();
    vi.mocked(sendGuestReservationEmail).mockReset();
    vi.mocked(sendHotelReservationEmail).mockReset();
  });

  it("bloqueia usuario sem permissao administrativa no hotel", async () => {
    mockReservation();
    vi.mocked(requireHotelAdminAccess).mockRejectedValue(new AuthorizationError());

    await expect(
      cancelReservationManually({
        reservationId: "reservation-1",
        userId: "user-1",
        reason: "Solicitado pelo hotel",
      })
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("cancela reserva pendente e registra auditoria", async () => {
    mockReservation();
    vi.mocked(closeUnpaidReservation).mockResolvedValue(true);

    await expect(
      cancelReservationManually({
        reservationId: "reservation-1",
        userId: "user-1",
        reason: "Hospede solicitou cancelamento",
      })
    ).resolves.toEqual({ status: "cancelled" });

    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "cancelled",
      providerPaymentId: "preference-1",
    });
    expect(prisma.reservationOperationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "reservation.cancelled",
          createdById: "user-1",
          reason: "Hospede solicitou cancelamento",
          previousStatus: "awaiting_payment",
          nextStatus: "cancelled",
        }),
      })
    );
  });

  it("confirma manualmente apenas reserva pendente", async () => {
    mockReservation({ status: "pending", paymentStatus: "pending" });
    vi.mocked(confirmPaidReservation).mockResolvedValue({
      reservationId: "reservation-1",
      confirmed: true,
    });

    await expect(
      confirmReservationManually({
        reservationId: "reservation-1",
        userId: "user-1",
        reason: "Pagamento validado manualmente",
      })
    ).resolves.toEqual({ status: "confirmed" });

    expect(confirmPaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      providerPaymentId: "preference-1",
      paymentMethod: "pix",
    });
    expect(prisma.reservationOperationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "reservation.manually_confirmed",
          nextStatus: "confirmed",
          nextPaymentStatus: "paid",
        }),
      })
    );
  });

  it("impede marcar pagamento pago como falho", async () => {
    mockReservation({
      status: "confirmed",
      paymentStatus: "paid",
      paymentTransaction: {
        status: "paid",
        providerPaymentId: "payment-1",
      },
    });

    await expect(
      markReservationPaymentFailed({
        reservationId: "reservation-1",
        userId: "user-1",
        reason: "Tentativa invalida",
      })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("reenvia e-mail somente para reserva confirmada", async () => {
    mockReservation({ status: "confirmed", paymentStatus: "paid" });

    await expect(
      resendReservationConfirmationEmail({
        reservationId: "reservation-1",
        userId: "user-1",
        reason: "Hospede solicitou reenvio",
      })
    ).resolves.toEqual({ status: "sent" });

    expect(sendHotelReservationEmail).toHaveBeenCalledTimes(1);
    expect(sendGuestReservationEmail).toHaveBeenCalledTimes(1);
    expect(prisma.reservationOperationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "reservation.confirmation_email_resent",
        }),
      })
    );
  });
});
