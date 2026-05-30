import {
  ConflictError,
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { calculatePaymentTransactionAmounts } from "@/lib/finance";
import { resolveHotelPaymentConfiguration, startReservationPayment } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { closeUnpaidReservation } from "@/lib/reservation-confirmation";
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

export async function POST(request: Request) {
  let createdReservationId: string | null = null;

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
        hotel: {
          include: {
            paymentSettings: true,
          },
        },
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

    const paymentConfiguration = resolveHotelPaymentConfiguration(room.hotel.paymentSettings);

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

    const reservation = await prisma.$transaction(async (transaction) => {
      const availabilityDates = getStayDates(checkIn, checkOut).map(toUtcDate);
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
          hotelId,
          roomId,
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
          status: "awaiting_payment",
          paymentProvider: paymentConfiguration.provider,
          paymentMethod,
          paymentStatus: "pending",
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
          provider: paymentConfiguration.provider,
          paymentMethod,
          status: "pending",
          ...calculatePaymentTransactionAmounts(totalPriceCents),
          currency: "BRL",
          paidAt: null,
        },
      });

      return createdReservation;
    });
    createdReservationId = reservation.id;

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    if (!origin) {
      throw new ValidationError("URL pública do site não configurada.");
    }

    const payment = await startReservationPayment({
      reservationId: reservation.id,
      method: paymentMethod,
      origin,
    });

    return createApiSuccessResponse(
      {
        reservation: {
          id: reservation.id,
          status: payment.status,
          createdAt: reservation.createdAt.toISOString(),
          totalPriceLabel: formatPriceInBRL(totalPriceCents),
        },
        checkoutUrl: payment.checkoutUrl,
        payment: {
          method: paymentMethod,
          checkoutUrl: payment.checkoutUrl,
          pix: payment.pix,
          boleto: payment.boleto,
        },
      },
      201
    );
  } catch (error) {
    if (createdReservationId) {
      const reservationId = createdReservationId;

      const closed = await closeUnpaidReservation({
        reservationId,
        status: "payment_failed",
      }).catch(() => false);

      if (!closed) {
        console.warn("[reservas] Reserva não foi encerrada após falha ao iniciar pagamento.", {
          reservationId,
        });
      }
    }

    return createApiErrorResponse(error, CREATE_RESERVATION_FAILURE);
  }
}
