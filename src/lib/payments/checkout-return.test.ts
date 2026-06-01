import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMercadoPagoCheckoutReturnNotice } from "@/lib/payments/checkout-return";
import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/payments/mercado-pago-reconciliation", () => ({
  syncMercadoPagoPayment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

const baseReservation = {
  id: "reservation-1",
  status: "awaiting_payment",
  paymentStatus: "awaiting_payment",
  paymentProvider: "mercado_pago",
  providerPaymentId: "preference-1",
};

describe("Mercado Pago checkout return", () => {
  beforeEach(() => {
    vi.mocked(syncMercadoPagoPayment).mockReset();
    vi.mocked(prisma.reservation.findUnique).mockReset();
    vi.mocked(prisma.reservation.findFirst).mockReset();
  });

  it("retorna sucesso para reserva confirmada", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...baseReservation,
      status: "confirmed",
      paymentStatus: "paid",
    } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      checkout: "success",
      reservation: "reservation-1",
    });

    expect(notice).toMatchObject({
      tone: "success",
      title: "Reserva confirmada",
    });
    expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("reconcilia reserva awaiting_payment no retorno aprovado", async () => {
    vi.mocked(prisma.reservation.findUnique)
      .mockResolvedValueOnce(baseReservation as never)
      .mockResolvedValueOnce({
        ...baseReservation,
        status: "confirmed",
        paymentStatus: "paid",
        providerPaymentId: "payment-1",
      } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      checkout: "success",
      reservation: "reservation-1",
      payment_id: "payment-1",
      preference_id: "preference-1",
    });

    expect(syncMercadoPagoPayment).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      paymentId: "payment-1",
      preferenceId: "preference-1",
      source: "return",
    });
    expect(notice).toMatchObject({
      tone: "success",
      title: "Reserva confirmada",
    });
  });

  it("mantem processamento quando segue awaiting_payment apos reconciliacao", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(baseReservation as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      checkout: "success",
      reservation: "reservation-1",
      payment: "payment-1",
    });

    expect(notice).toMatchObject({
      tone: "processing",
      title: "Pagamento em processamento",
    });
  });

  it("retorna falha para reserva cancelada", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...baseReservation,
      status: "cancelled",
      paymentStatus: "cancelled",
    } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      checkout: "cancelled",
      reservation: "reservation-1",
    });

    expect(notice).toMatchObject({
      tone: "error",
      title: "Pagamento cancelado",
    });
    expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("retorna expirada para reserva expired", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...baseReservation,
      status: "expired",
      paymentStatus: "cancelled",
    } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      reservation: "reservation-1",
      status: "cancelled",
    });

    expect(notice).toMatchObject({
      tone: "error",
      title: "Reserva expirada",
    });
    expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("retorna falha para reserva com pagamento recusado", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...baseReservation,
      status: "payment_failed",
      paymentStatus: "payment_failed",
    } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      reservation: "reservation-1",
      status: "rejected",
    });

    expect(notice).toMatchObject({
      tone: "error",
      title: "Pagamento nao aprovado",
    });
    expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("retorna erro amigavel quando reserva nao existe", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      checkout: "success",
      reservation: "reservation-inexistente",
    });

    expect(notice).toMatchObject({
      tone: "error",
      title: "Reserva nao encontrada",
    });
  });

  it("usa payment_id para reconciliar quando reservation nao veio no retorno", async () => {
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(null);
    vi.mocked(syncMercadoPagoPayment).mockResolvedValue({
      changed: true,
      reservationId: "reservation-1",
      remoteStatus: "approved",
    });
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      ...baseReservation,
      status: "confirmed",
      paymentStatus: "paid",
      providerPaymentId: "payment-1",
    } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      checkout: "success",
      payment_id: "payment-1",
    });

    expect(syncMercadoPagoPayment).toHaveBeenCalledWith({
      reservationId: null,
      paymentId: "payment-1",
      preferenceId: null,
      source: "return",
    });
    expect(notice).toMatchObject({
      tone: "success",
      title: "Reserva confirmada",
    });
  });

  it("localiza reserva por preference_id quando reservation nao veio no retorno", async () => {
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...baseReservation,
      status: "confirmed",
      paymentStatus: "paid",
    } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      preference_id: "preference-1",
      status: "approved",
    });

    expect(prisma.reservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentProvider: "mercado_pago",
        }),
      })
    );
    expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
    expect(notice).toMatchObject({
      tone: "success",
      title: "Reserva confirmada",
    });
  });

  it("aceita retorno Mercado Pago sem checkout quando status veio aprovado", async () => {
    vi.mocked(prisma.reservation.findUnique)
      .mockResolvedValueOnce(baseReservation as never)
      .mockResolvedValueOnce({
        ...baseReservation,
        status: "confirmed",
        paymentStatus: "paid",
        providerPaymentId: "payment-1",
      } as never);

    const notice = await getMercadoPagoCheckoutReturnNotice({
      reservation: "reservation-1",
      payment_id: "payment-1",
      status: "approved",
    });

    expect(syncMercadoPagoPayment).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      paymentId: "payment-1",
      preferenceId: "preference-1",
      source: "return",
    });
    expect(notice).toMatchObject({
      tone: "success",
      title: "Reserva confirmada",
    });
  });
});
