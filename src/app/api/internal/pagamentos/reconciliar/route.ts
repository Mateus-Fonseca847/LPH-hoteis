import { NextResponse } from "next/server";

import { createApiErrorResponse, ValidationError } from "@/lib/errors/app-error";
import {
  reconcileRecentAwaitingMercadoPagoReservations,
  syncMercadoPagoPayment,
} from "@/lib/payments/mercado-pago-reconciliation";

function getInternalToken() {
  return process.env.INTERNAL_API_TOKEN?.trim() || process.env.CRON_SECRET?.trim() || "";
}

function getRequestToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-internal-token")?.trim() || "";
}

export async function POST(request: Request) {
  try {
    const expectedToken = getInternalToken();

    if (!expectedToken) {
      throw new ValidationError("Token interno nao configurado.");
    }

    if (getRequestToken(request) !== expectedToken) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      paymentId?: string;
      preferenceId?: string;
      reservationId?: string;
    } | null;

    if (body?.paymentId || body?.preferenceId || body?.reservationId) {
      const result = await syncMercadoPagoPayment({
        paymentId: body.paymentId,
        preferenceId: body.preferenceId,
        reservationId: body.reservationId,
        source: "manual",
      });

      return NextResponse.json(result);
    }

    const result = await reconcileRecentAwaitingMercadoPagoReservations();

    return NextResponse.json(result);
  } catch (error) {
    return createApiErrorResponse(error, "Nao foi possivel reconciliar pagamentos.");
  }
}
