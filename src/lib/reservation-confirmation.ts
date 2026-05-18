import { ConflictError, ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { getStayDates } from "@/lib/stay-query";

type ConfirmPaidReservationInput = {
  reservationId: string;
  providerPaymentId?: string | null;
  paymentMethod?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
};

type ConfirmPaidReservationResult = {
  reservationId: string;
  confirmed: boolean;
};

type CloseUnpaidReservationInput = {
  reservationId: string;
  status: "payment_failed" | "cancelled";
  providerPaymentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
};

function toUtcDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

export async function releaseReservationAvailability(reservationId: string) {
  return prisma.$transaction(async (transaction) => {
    const reservation = await transaction.reservation.findUnique({
      where: {
        id: reservationId,
      },
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        availabilityHeld: true,
      },
    });

    if (!reservation?.availabilityHeld) {
      return false;
    }

    const availabilityDates = getStayDates(reservation.checkIn, reservation.checkOut).map(
      toUtcDate
    );

    const reservationUpdate = await transaction.reservation.updateMany({
      where: {
        id: reservation.id,
        availabilityHeld: true,
      },
      data: {
        availabilityHeld: false,
      },
    });

    if (reservationUpdate.count === 0) {
      return false;
    }

    await transaction.roomAvailability.updateMany({
      where: {
        roomId: reservation.roomId,
        date: {
          in: availabilityDates,
        },
      },
      data: {
        availableUnits: {
          increment: 1,
        },
      },
    });

    return true;
  });
}

export async function closeUnpaidReservation({
  reservationId,
  status,
  providerPaymentId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
}: CloseUnpaidReservationInput) {
  return prisma.$transaction(async (transaction) => {
    const reservation = await transaction.reservation.findUnique({
      where: {
        id: reservationId,
      },
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        availabilityHeld: true,
        paymentStatus: true,
      },
    });

    if (!reservation || reservation.paymentStatus === "paid") {
      return false;
    }

    if (reservation.availabilityHeld) {
      const reservationUpdate = await transaction.reservation.updateMany({
        where: {
          id: reservation.id,
          availabilityHeld: true,
          paymentStatus: {
            not: "paid",
          },
        },
        data: {
          status,
          paymentStatus: status,
          providerPaymentId,
          stripeCheckoutSessionId,
          stripePaymentIntentId,
          availabilityHeld: false,
        },
      });

      if (reservationUpdate.count === 0) {
        return false;
      }

      const availabilityDates = getStayDates(reservation.checkIn, reservation.checkOut).map(
        toUtcDate
      );

      await transaction.roomAvailability.updateMany({
        where: {
          roomId: reservation.roomId,
          date: {
            in: availabilityDates,
          },
        },
        data: {
          availableUnits: {
            increment: 1,
          },
        },
      });

      return true;
    }

    const reservationUpdate = await transaction.reservation.updateMany({
      where: {
        id: reservation.id,
        status: {
          in: ["pending", "awaiting_payment"],
        },
        paymentStatus: {
          not: "paid",
        },
      },
      data: {
        status,
        paymentStatus: status,
        providerPaymentId,
        stripeCheckoutSessionId,
        stripePaymentIntentId,
      },
    });

    return reservationUpdate.count > 0;
  });
}

export async function confirmPaidReservation({
  reservationId,
  providerPaymentId,
  paymentMethod,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
}: ConfirmPaidReservationInput): Promise<ConfirmPaidReservationResult | null> {
  return prisma.$transaction(async (transaction) => {
    const reservation = await transaction.reservation.findUnique({
      where: {
        id: reservationId,
      },
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        status: true,
        paymentStatus: true,
        availabilityHeld: true,
      },
    });

    if (!reservation) {
      return null;
    }

    if (reservation.paymentStatus === "paid") {
      return {
        reservationId: reservation.id,
        confirmed: false,
      };
    }

    if (!["pending", "awaiting_payment"].includes(reservation.status)) {
      throw new ValidationError("Reserva não pode ser confirmada.");
    }

    const stayDates = getStayDates(reservation.checkIn, reservation.checkOut);
    const availabilityDates = stayDates.map(toUtcDate);
    const availabilityRows = await transaction.roomAvailability.count({
      where: {
        roomId: reservation.roomId,
        date: {
          in: availabilityDates,
        },
        closed: false,
      },
    });

    if (availabilityRows !== stayDates.length) {
      throw new ConflictError("Quarto indisponível para confirmar a reserva.");
    }

    if (!reservation.availabilityHeld) {
      const availabilityUpdate = await transaction.roomAvailability.updateMany({
        where: {
          roomId: reservation.roomId,
          date: {
            in: availabilityDates,
          },
          closed: false,
          availableUnits: {
            gt: 0,
          },
        },
        data: {
          availableUnits: {
            decrement: 1,
          },
        },
      });

      if (availabilityUpdate.count !== stayDates.length) {
        throw new ConflictError("Quarto indisponível para confirmar a reserva.");
      }
    }

    const paidAt = new Date();
    const reservationUpdate = await transaction.reservation.updateMany({
      where: {
        id: reservation.id,
        status: {
          in: ["pending", "awaiting_payment"],
        },
        paymentStatus: {
          not: "paid",
        },
      },
      data: {
        status: "confirmed",
        paymentStatus: "paid",
        providerPaymentId,
        paymentMethod,
        stripeCheckoutSessionId,
        stripePaymentIntentId,
        availabilityHeld: true,
        paidAt,
      },
    });

    if (reservationUpdate.count === 0) {
      return {
        reservationId: reservation.id,
        confirmed: false,
      };
    }

    return {
      reservationId: reservation.id,
      confirmed: true,
    };
  });
}
