import { randomUUID } from "node:crypto";

import {
  ConflictError,
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { calculatePaymentTransactionAmounts } from "@/lib/finance";
import { createPayment, resolveHotelPaymentConfiguration } from "@/lib/payments";
import { getPaymentWebhookUrl } from "@/lib/payments/config";
import { prisma } from "@/lib/prisma";
import {
  expirePendingReservations,
  getBookingPaymentExpiresAt,
} from "@/lib/reservation-expiration";
import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";
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

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    if (!origin) {
      throw new ValidationError("URL pública do site não configurada.");
    }

    const reservationId = randomUUID();
    const successUrl = `${origin}/hoteis/${room.hotel.slug}?checkout=success&reservation=${reservationId}`;
    const failureUrl = `${origin}/hoteis/${room.hotel.slug}?checkout=cancelled&reservation=${reservationId}`;

    // Cria reserva, segura disponibilidade e registra pagamento pendente em uma unica transacao.
    // Qualquer falha reverte tudo, impedindo disponibilidade reduzida sem reserva valida.
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
          id: reservationId,
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
          paymentProvider: paymentConfiguration.provider,
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

    let payment: Awaited<ReturnType<typeof createPayment>>;

    try {
      payment = await createPayment({
        provider: paymentConfiguration.provider,
        method: paymentMethod,
        reservationId,
        hotelName: room.hotel.name,
        roomName: room.name,
        guestName,
        guestEmail,
        totalPriceCents,
        currency: "BRL",
        description: `${nights} ${nights === 1 ? "noite" : "noites"} para ${adults} adulto(s) e ${children} criança(s).`,
        successUrl,
        failureUrl,
        notificationUrl: getPaymentWebhookUrl(paymentConfiguration.provider, origin),
        accessToken: paymentConfiguration.accessToken,
      });
    } catch (error) {
      await closeUnpaidReservation({
        reservationId,
        status: "payment_failed",
      });

      throw error;
    }

    try {
      if (payment.status === "paid") {
        const confirmation = await confirmPaidReservation({
          reservationId,
          providerPaymentId: payment.providerPaymentId,
          paymentMethod,
        });

        if (!confirmation?.confirmed) {
          throw new ConflictError("Pagamento aprovado não confirmou a reserva.");
        }
      } else {
        // Vincula o checkout externo a reserva e transacao financeira de forma atomica.
        // Se a gravacao falhar, nenhuma das duas tabelas fica com status/provider divergente.
        const linkedPayment = await prisma.$transaction(async (transaction) => {
          const reservationUpdate = await transaction.reservation.updateMany({
            where: {
              id: reservationId,
              status: "pending",
              paymentStatus: "pending",
            },
            data: {
              status: payment.status,
              paymentStatus: payment.status,
              providerPaymentId: payment.providerPaymentId,
            },
          });

          if (reservationUpdate.count !== 1) {
            throw new ConflictError("Reserva não pode receber o pagamento iniciado.");
          }

          const paymentTransactionUpdate = await transaction.paymentTransaction.updateMany({
            where: {
              reservationId,
              status: "pending",
            },
            data: {
              providerPaymentId: payment.providerPaymentId,
              status: payment.status,
            },
          });

          if (paymentTransactionUpdate.count !== 1) {
            throw new ConflictError("Transação financeira não pode receber o pagamento iniciado.");
          }

          return {
            status: payment.status,
          };
        });

        reservation.status = linkedPayment.status;
      }
    } catch (error) {
      if (payment.status !== "paid") {
        await closeUnpaidReservation({
          reservationId,
          status: "payment_failed",
          providerPaymentId: payment.providerPaymentId,
        });
      }

      throw error;
    }

    return createApiSuccessResponse(
      {
        reservation: {
          id: reservation.id,
          status: payment.status === "paid" ? "confirmed" : reservation.status,
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
