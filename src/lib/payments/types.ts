export type PaymentProvider = "manual" | "mercado_pago";

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "boleto";

export type PaymentStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "payment_failed"
  | "cancelled";

export type CreatePaymentInput = {
  provider: PaymentProvider;
  method: PaymentMethod;
  reservationId: string;
  hotelName: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  totalPriceCents: number;
  currency: "BRL";
  description: string;
  successUrl: string;
  failureUrl: string;
  notificationUrl?: string;
  accessToken?: string | null;
};

export type CreatePaymentResult = {
  provider: PaymentProvider;
  providerPaymentId: string;
  checkoutUrl?: string | null;
  pix?: {
    qrCodeImageUrl?: string | null;
    copyPaste?: string | null;
  };
  boleto?: {
    url?: string | null;
    digitableLine?: string | null;
    expiresAt?: string | null;
  };
  status: PaymentStatus;
  rawStatus?: string;
};
