import type Stripe from "stripe";

import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { upsertPaidPaymentTransactionForReservation } from "@/lib/finance/payment-transactions";
import { prisma } from "@/lib/prisma";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

const WEBHOOK_FAILURE_MESSAGE = "Não foi possível processar o webhook de pagamento.";

async function notifyPaidReservation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      hotel: true,
      room: true,
    },
  });

  if (!reservation) {
    throw new ValidationError("Reserva não encontrada.");
  }

  const emailInput = {
    hotelEmail: reservation.hotel.email,
    hotelName: reservation.hotel.name,
    roomName: reservation.room.name,
    guestName: reservation.guestName,
    guestEmail: reservation.guestEmail,
    guestPhone: reservation.guestPhone,
    guestDocument: reservation.guestDocument ?? undefined,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    adults: reservation.adults,
    children: reservation.children,
    nights: reservation.nights,
    nightlyPriceCents: reservation.nightlyPriceCents,
    totalPriceCents: reservation.totalPriceCents,
    reservationId: reservation.id,
  };

  await sendHotelReservationEmail(emailInput);

  try {
    await sendGuestReservationEmail(emailInput);
  } catch (error) {
    console.warn("[stripe/webhook] Falha ao enviar confirmação para o cliente.", error);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId || session.client_reference_id;

  if (!reservationId || session.payment_status !== "paid") {
    return;
  }

  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!reservation) {
    return;
  }

  if (reservation.paymentStatus === "paid") {
    await upsertPaidPaymentTransactionForReservation(reservation.id);
    return;
  }

  await prisma.reservation.update({
    where: {
      id: reservation.id,
    },
    data: {
      status: "confirmed",
      paymentStatus: "paid",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
      paidAt: new Date(),
    },
  });

  await upsertPaidPaymentTransactionForReservation(reservation.id);
  await notifyPaidReservation(reservation.id);
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId || session.client_reference_id;

  if (!reservationId) {
    return;
  }

  await prisma.reservation.updateMany({
    where: {
      id: reservationId,
      status: {
        in: ["pending", "awaiting_payment"],
      },
    },
    data: {
      status: "payment_failed",
      paymentStatus: "payment_failed",
      stripeCheckoutSessionId: session.id,
    },
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const reservationId = paymentIntent.metadata.reservationId;

  if (!reservationId) {
    return;
  }

  await prisma.reservation.updateMany({
    where: {
      id: reservationId,
      status: {
        in: ["pending", "awaiting_payment"],
      },
    },
    data: {
      status: "payment_failed",
      paymentStatus: "payment_failed",
      stripePaymentIntentId: paymentIntent.id,
    },
  });
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      throw new ValidationError("Assinatura do webhook ausente.");
    }

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret()
    );

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    }

    if (event.type === "checkout.session.expired") {
      await handleCheckoutFailed(event.data.object);
    }

    if (event.type === "payment_intent.payment_failed") {
      await handlePaymentIntentFailed(event.data.object);
    }

    return createApiSuccessResponse({
      received: true,
    });
  } catch (error) {
    return createApiErrorResponse(error, WEBHOOK_FAILURE_MESSAGE);
  }
}
