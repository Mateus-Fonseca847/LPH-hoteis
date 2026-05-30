import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mercado-pago/webhook/route";
import { getMercadoPagoPayment } from "@/lib/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { closeUnpaidReservation, confirmPaidReservation } from "@/lib/reservation-confirmation";
import { sendGuestReservationEmail, sendHotelReservationEmail } from "@/lib/reservations";

vi.mock("@/lib/payments/mercado-pago", () => ({
  getMercadoPagoPayment: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentTransaction: {
      findUnique: vi.fn(),
    },
    reservation: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/reservation-confirmation", () => ({
  closeUnpaidReservation: vi.fn(),
  confirmPaidReservation: vi.fn(),
}));
vi.mock("@/lib/reservations", () => ({
  sendGuestReservationEmail: vi.fn(),
  sendHotelReservationEmail: vi.fn(),
}));

const paymentId = "12345";
const secret = "segredo-fake-webhook";
const transaction = {
  id: "transaction-1",
  provider: "mercado_pago",
  providerPaymentId: "preference-1",
  status: "awaiting_payment",
  grossAmountCents: 75000,
  currency: "BRL",
  reservation: {
    id: "reservation-1",
    providerPaymentId: "preference-1",
    paymentStatus: "awaiting_payment",
    totalPriceCents: 75000,
    currency: "BRL",
  },
};
const reservationWithEmailData = {
  id: "reservation-1",
  guestName: "Maria Silva",
  guestEmail: "maria@example.test",
  guestPhone: "11999999999",
  guestDocument: "AB123456",
  checkIn: new Date(Date.UTC(2099, 6, 10)),
  checkOut: new Date(Date.UTC(2099, 6, 12)),
  adults: 2,
  children: 1,
  nights: 2,
  nightlyPriceCents: 37500,
  totalPriceCents: 75000,
  paymentMethod: "pix",
  hotel: {
    email: "hotel@example.test",
    name: "Hotel LPH",
  },
  room: {
    name: "Suite Vista Mar",
  },
};

function createWebhookRequest() {
  const requestId = "request-1";
  const timestamp = "1742505638683";
  const signature = createHmac("sha256", secret)
    .update(`id:${paymentId};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");

  return new Request(`http://localhost/api/mercado-pago/webhook?data.id=${paymentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-signature": `ts=${timestamp},v1=${signature}`,
    },
    body: JSON.stringify({
      type: "payment",
      action: "payment.updated",
      data: {
        id: paymentId,
      },
    }),
  });
}

function mockTransactionLookup(record = transaction) {
  vi.mocked(prisma.paymentTransaction.findUnique).mockImplementation(
    async ({ where }: { where: { providerPaymentId?: string; reservationId?: string } }) =>
      (where.providerPaymentId ? null : record) as never
  );
}

describe("Mercado Pago webhook", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMENT_WEBHOOK_SECRET", secret);
    vi.mocked(getMercadoPagoPayment).mockReset();
    vi.mocked(prisma.paymentTransaction.findUnique).mockReset();
    vi.mocked(prisma.reservation.findUnique).mockReset();
    vi.mocked(confirmPaidReservation).mockReset();
    vi.mocked(closeUnpaidReservation).mockReset();
    vi.mocked(sendGuestReservationEmail).mockReset();
    vi.mocked(sendHotelReservationEmail).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("confirma apenas pagamento aprovado vinculado ao valor da reserva", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "approved",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });
    vi.mocked(confirmPaidReservation).mockResolvedValue({
      reservationId: "reservation-1",
      confirmed: false,
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      providerPaymentId: paymentId,
      paymentMethod: "bank_transfer",
    });
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("envia e-mails uma vez quando pagamento aprovado confirma a reserva", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "approved",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });
    vi.mocked(confirmPaidReservation).mockResolvedValue({
      reservationId: "reservation-1",
      confirmed: true,
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(reservationWithEmailData as never);

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(sendHotelReservationEmail).toHaveBeenCalledTimes(1);
    expect(sendGuestReservationEmail).toHaveBeenCalledTimes(1);
  });

  it("mantem reserva pendente quando o provedor retorna pagamento pendente", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "pending",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("fecha reserva nao paga quando o provedor retorna pagamento recusado", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "rejected",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "payment_failed",
      providerPaymentId: paymentId,
    });
  });

  it("cancela reserva nao paga quando o provedor retorna pagamento cancelado", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "cancelled",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      status: "cancelled",
      providerPaymentId: paymentId,
    });
  });

  it("rejeita webhook com assinatura invalida antes de consultar o provedor", async () => {
    const request = new Request(`http://localhost/api/mercado-pago/webhook?data.id=${paymentId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "request-1",
        "x-signature": "ts=1742505638683,v1=assinatura-invalida",
      },
      body: JSON.stringify({
        type: "payment",
        data: {
          id: paymentId,
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(getMercadoPagoPayment).not.toHaveBeenCalled();
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("não confirma pagamento aprovado com valor diferente da reserva", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "approved",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 100,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(400);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("não cancela reserva por pagamento recusado sem vínculo de valor", async () => {
    mockTransactionLookup();
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "rejected",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 100,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(400);
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });

  it("não confirma novamente webhook aprovado repetido", async () => {
    mockTransactionLookup({
      ...transaction,
      providerPaymentId: paymentId,
      status: "paid",
      reservation: {
        ...transaction.reservation,
        providerPaymentId: paymentId,
        paymentStatus: "paid",
      },
    });
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "approved",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
    expect(sendHotelReservationEmail).not.toHaveBeenCalled();
    expect(sendGuestReservationEmail).not.toHaveBeenCalled();
  });

  it("nao encerra novamente webhook recusado repetido", async () => {
    mockTransactionLookup({
      ...transaction,
      providerPaymentId: paymentId,
      status: "payment_failed",
      reservation: {
        ...transaction.reservation,
        providerPaymentId: paymentId,
        paymentStatus: "payment_failed",
      },
    });
    vi.mocked(getMercadoPagoPayment).mockResolvedValue({
      id: paymentId,
      status: "rejected",
      statusDetail: undefined,
      reservationId: "reservation-1",
      paymentMethodId: "pix",
      paymentTypeId: "bank_transfer",
      totalPriceCents: 75000,
      currency: "BRL",
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    expect(confirmPaidReservation).not.toHaveBeenCalled();
    expect(closeUnpaidReservation).not.toHaveBeenCalled();
  });
});
