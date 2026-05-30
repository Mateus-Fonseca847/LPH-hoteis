import type Stripe from "stripe";

import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import {
  isPaymentWebhookAlreadyProcessed,
  validatePaymentWebhookIdentity,
} from "@/lib/payments/webhook-idempotency";
import { prisma } from "@/lib/prisma";
import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

const WEBHOOK_FAILURE_MESSAGE = "Não foi possível processar o webhook de pagamento.";

function getStripePaymentIntentId(value: Stripe.Checkout.Session["payment_intent"]) {
  return typeof value === "string" ? value : value?.id;
}

async function findReservationForWebhook(reservationId: string) {
  return prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      providerPaymentId: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
    },
  });
}

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

  const reservation = await findReservationForWebhook(reservationId);

  if (!reservation) {
    return;
  }

  const stripePaymentIntentId = getStripePaymentIntentId(session.payment_intent);
  validatePaymentWebhookIdentity({
    reservation,
    reservationId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
  });

  if (
    isPaymentWebhookAlreadyProcessed({
      reservation,
      reservationId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId,
    })
  ) {
    return;
  }

  const confirmation = await confirmPaidReservation({
    reservationId: reservation.id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
  });

  if (confirmation?.confirmed) {
    await notifyPaidReservation(reservation.id);
  }
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId || session.client_reference_id;

  if (!reservationId) {
    return;
  }

  const reservation = await findReservationForWebhook(reservationId);

  if (!reservation) {
    return;
  }

  validatePaymentWebhookIdentity({
    reservation,
    reservationId,
    stripeCheckoutSessionId: session.id,
  });

  if (
    isPaymentWebhookAlreadyProcessed({
      reservation,
      reservationId,
      stripeCheckoutSessionId: session.id,
    })
  ) {
    return;
  }

  await closeUnpaidReservation({
    reservationId,
    status: "cancelled",
    stripeCheckoutSessionId: session.id,
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const reservationId = paymentIntent.metadata.reservationId;

  if (!reservationId) {
    return;
  }

  const reservation = await findReservationForWebhook(reservationId);

  if (!reservation) {
    return;
  }

  validatePaymentWebhookIdentity({
    reservation,
    reservationId,
    stripePaymentIntentId: paymentIntent.id,
  });

  if (
    isPaymentWebhookAlreadyProcessed({
      reservation,
      reservationId,
      stripePaymentIntentId: paymentIntent.id,
    })
  ) {
    return;
  }

  await closeUnpaidReservation({
    reservationId,
    status: "payment_failed",
    stripePaymentIntentId: paymentIntent.id,
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
