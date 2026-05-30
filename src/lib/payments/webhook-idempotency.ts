import { ConflictError, ValidationError } from "@/lib/errors/app-error";

type ReservationIdentity = {
  id: string;
  providerPaymentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
};

type PaymentTransactionIdentity = {
  providerPaymentId?: string | null;
  status?: string | null;
  reservation?: ReservationIdentity | null;
};

type PaymentWebhookIdentityInput = {
  reservation: ReservationIdentity;
  externalReference?: string | null;
  reservationId?: string | null;
  providerPaymentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  paymentTransaction?: PaymentTransactionIdentity | null;
};

function assertSameReservation(reference?: string | null, reservationId?: string | null) {
  if (reference && reservationId && reference !== reservationId) {
    throw new ValidationError("Webhook não corresponde à reserva.");
  }
}

function assertSameIdentifier(existing?: string | null, incoming?: string | null) {
  if (existing && incoming && existing !== incoming) {
    throw new ConflictError("Webhook já vinculado a outro identificador de pagamento.");
  }
}

export function validatePaymentWebhookIdentity({
  reservation,
  externalReference,
  reservationId,
  providerPaymentId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  paymentTransaction,
}: PaymentWebhookIdentityInput) {
  assertSameReservation(externalReference, reservation.id);
  assertSameReservation(reservationId, reservation.id);
  assertSameReservation(paymentTransaction?.reservation?.id, reservation.id);

  if (reservation.paymentStatus === "paid" || paymentTransaction?.status === "paid") {
    assertSameIdentifier(reservation.providerPaymentId, providerPaymentId);
    assertSameIdentifier(paymentTransaction?.providerPaymentId, providerPaymentId);
    assertSameIdentifier(reservation.stripeCheckoutSessionId, stripeCheckoutSessionId);
    assertSameIdentifier(reservation.stripePaymentIntentId, stripePaymentIntentId);
  }
}

export function isPaymentWebhookAlreadyProcessed({
  reservation,
  providerPaymentId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  paymentTransaction,
}: PaymentWebhookIdentityInput) {
  const isPaid = reservation.paymentStatus === "paid" || paymentTransaction?.status === "paid";

  if (isPaid) {
    return true;
  }

  if (
    stripeCheckoutSessionId &&
    reservation.stripeCheckoutSessionId === stripeCheckoutSessionId &&
    ["cancelled", "payment_failed"].includes(reservation.paymentStatus ?? "")
  ) {
    return true;
  }

  if (
    stripePaymentIntentId &&
    reservation.stripePaymentIntentId === stripePaymentIntentId &&
    ["cancelled", "payment_failed"].includes(reservation.paymentStatus ?? "")
  ) {
    return true;
  }

  return Boolean(
    providerPaymentId &&
      reservation.providerPaymentId === providerPaymentId &&
      paymentTransaction?.providerPaymentId === providerPaymentId &&
      ["cancelled", "payment_failed"].includes(reservation.paymentStatus ?? "")
  );
}
