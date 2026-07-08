import { randomUUID } from "node:crypto";

import {
  ConflictError,
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { calculatePaymentTransactionAmounts } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import {
  expirePendingReservations,
  getBookingPaymentExpiresAt,
} from "@/lib/reservation-expiration";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";
import {
  calculateStayNights,
  canRoomAccommodateGuests,
  formatPriceInBRL,
  getRoomStayAvailabilityStatus,
  getRoomStayPriceEstimate,
  getStayDates,
} from "@/lib/stay-query";
import { parseCreateReservationPayload } from "@/lib/validations/reservation";

const CREATE_RESERVATION_FAILURE = "Não foi possível criar a reserva.";

function toUtcDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayDateOnly() {
  return toDateOnly(new Date());
}

function getRoomUnitCount(room: { units?: number | null }) {
  return Number.isInteger(room.units) && room.units && room.units > 0 ? room.units : 1;
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Dados da reserva inválidos.");
    }

    const parsedPayload = parseCreateReservationPayload(body);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    const {
      hotelId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      guestDocument,
      checkIn,
      checkOut,
      adults,
      children,
      paymentMethod,
      paymentCardBrand,
      paymentObservation1,
      paymentObservation2,
      paymentObservation3,
    } = parsedPayload.data;

    if (checkIn < getTodayDateOnly()) {
      throw new ValidationError("Check-in não pode estar no passado.");
    }

    let nights: number;

    try {
      nights = calculateStayNights(checkIn, checkOut);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "Datas da reserva inválidas."
      );
    }

    await expirePendingReservations({
      roomId,
      checkIn,
      checkOut,
    });

    const room = await prisma.hotelRoom.findFirst({
      where: {
        id: roomId,
        hotelId,
        isActive: true,
        hotel: {
          isPublished: true,
        },
      },
      include: {
        hotel: true,
        availability: true,
        rates: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!room) {
      throw new ValidationError("Quarto indisponível para reserva.");
    }

    if (!room.isAvailable || !canRoomAccommodateGuests(room, adults, children)) {
      throw new ValidationError("O quarto selecionado não comporta essa ocupação.");
    }

    const roomSnapshot = {
      ...room,
      availability: room.availability.map((entry) => ({
        date: toDateOnly(entry.date),
        availableUnits: entry.availableUnits,
        closed: entry.closed,
      })),
      rates: room.rates.map((rate) => ({
        id: rate.id,
        name: rate.name,
        description: rate.description,
        priceCents: rate.priceCents,
        currency: rate.currency,
        startDate: toDateOnly(rate.startDate),
        endDate: toDateOnly(rate.endDate),
        minNights: rate.minNights,
        maxGuests: rate.maxGuests,
        refundable: rate.refundable,
        breakfastIncluded: rate.breakfastIncluded,
      })),
    };
    const availabilityStatus = getRoomStayAvailabilityStatus(
      roomSnapshot,
      checkIn,
      checkOut,
      adults,
      children
    );

    if (availabilityStatus !== "available") {
      throw new ValidationError("O quarto não está disponível para o período selecionado.");
    }

    const priceEstimate = getRoomStayPriceEstimate(
      roomSnapshot,
      checkIn,
      checkOut,
      adults,
      children
    );
    const fallbackNightlyPriceCents = Math.round(Number(room.priceFrom) * 100);
    const nightlyPriceCents = priceEstimate?.nightlyPriceCents ?? fallbackNightlyPriceCents;
    const totalPriceCents = priceEstimate?.totalPriceCents ?? nightlyPriceCents * nights;

    if (!Number.isInteger(nightlyPriceCents) || nightlyPriceCents <= 0) {
      throw new ValidationError("Não foi possível calcular o valor da reserva.");
    }

    const reservationId = randomUUID();

    const reservation = await prisma.$transaction(async (transaction) => {
      const availabilityDates = getStayDates(checkIn, checkOut).map(toUtcDate);
      const roomUnits = getRoomUnitCount(room);
      const existingAvailability = await transaction.roomAvailability.findMany({
        where: {
          roomId,
          date: {
            in: availabilityDates,
          },
        },
        select: {
          date: true,
        },
      });
      const existingDates = new Set(existingAvailability.map((entry) => toDateOnly(entry.date)));
      const missingAvailabilityDates = availabilityDates.filter(
        (date) => !existingDates.has(toDateOnly(date))
      );

      if (missingAvailabilityDates.length > 0) {
        await transaction.roomAvailability.createMany({
          data: missingAvailabilityDates.map((date) => ({
            roomId,
            date,
            totalUnits: roomUnits,
            availableUnits: roomUnits,
            closed: false,
          })),
          skipDuplicates: true,
        });
      }

      const availabilityUpdate = await transaction.roomAvailability.updateMany({
        where: {
          roomId,
          room: {
            is: {
              hotelId,
              isActive: true,
              isAvailable: true,
              hotel: {
                isPublished: true,
              },
            },
          },
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

      if (availabilityUpdate.count !== nights) {
        throw new ConflictError("O quarto não está disponível para o período selecionado.");
      }

      const createdReservation = await transaction.reservation.create({
        data: {
          id: reservationId,
          hotelId,
          roomId,
          guestName,
          guestEmail,
          guestPhone,
          guestDocument,
          paymentObservation1: paymentObservation1 || null,
          paymentObservation2: paymentObservation2 || null,
          paymentObservation3: paymentObservation3 || null,
          paymentCardBrand,
          checkIn: toUtcDate(checkIn),
          checkOut: toUtcDate(checkOut),
          adults,
          children,
          nights,
          nightlyPriceCents,
          totalPriceCents,
          status: "pending",
          paymentProvider: "manual",
          paymentMethod,
          paymentStatus: "pending",
          expiresAt: getBookingPaymentExpiresAt(),
          availabilityHeld: true,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      });

      await transaction.paymentTransaction.create({
        data: {
          reservationId: createdReservation.id,
          hotelId,
          provider: "manual",
          paymentMethod,
          status: "pending",
          ...calculatePaymentTransactionAmounts(totalPriceCents),
          currency: "BRL",
          paidAt: null,
        },
      });

      return createdReservation;
    });

    await sendHotelReservationEmail({
      hotelEmail: room.hotel.email,
      hotelName: room.hotel.name,
      roomName: room.name,
      guestName,
      guestEmail,
      guestPhone,
      guestDocument,
      checkIn: toUtcDate(checkIn),
      checkOut: toUtcDate(checkOut),
      adults,
      children,
      nights,
      nightlyPriceCents,
      totalPriceCents,
      reservationId: reservation.id,
      paymentMethod,
      paymentCardBrand,
      paymentObservation1,
      paymentObservation2,
      paymentObservation3,
    });

    await sendGuestReservationEmail({
      hotelEmail: room.hotel.email,
      hotelName: room.hotel.name,
      roomName: room.name,
      guestName,
      guestEmail,
      guestPhone,
      guestDocument,
      checkIn: toUtcDate(checkIn),
      checkOut: toUtcDate(checkOut),
      adults,
      children,
      nights,
      nightlyPriceCents,
      totalPriceCents,
      reservationId: reservation.id,
      paymentMethod,
      paymentCardBrand,
      paymentObservation1,
      paymentObservation2,
      paymentObservation3,
    });

    return createApiSuccessResponse(
      {
        reservation: {
          id: reservation.id,
          status: reservation.status,
          createdAt: reservation.createdAt.toISOString(),
          totalPriceLabel: formatPriceInBRL(totalPriceCents),
        },
      },
      201
    );
  } catch (error) {
    return createApiErrorResponse(error, CREATE_RESERVATION_FAILURE);
  }
}
