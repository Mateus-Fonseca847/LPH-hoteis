import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { resolveHotelPaymentConfiguration, startReservationPayment } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import {
  calculateStayNights,
  canRoomAccommodateGuests,
  formatPriceInBRL,
  getRoomStayAvailabilityStatus,
  getRoomStayPriceEstimate,
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

    const nights = calculateStayNights(checkIn, checkOut);
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

    resolveHotelPaymentConfiguration(room.hotel.paymentSettings);

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

    if (availabilityStatus === "unavailable") {
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

    const reservation = await prisma.reservation.create({
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
        status: "pending",
        paymentProvider: "mercado_pago",
        paymentMethod,
        paymentStatus: "pending",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
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
    return createApiErrorResponse(error, CREATE_RESERVATION_FAILURE);
  }
}
