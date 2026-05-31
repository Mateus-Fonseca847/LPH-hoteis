import { NextResponse } from "next/server";

import { createApiErrorResponse, ValidationError } from "@/lib/errors/app-error";
import { reconcileRecentAwaitingMercadoPagoReservations } from "@/lib/payments/mercado-pago-reconciliation";
import { expirePendingReservations } from "@/lib/reservation-expiration";

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
      throw new ValidationError("Token interno nÃ£o configurado.");
    }

    if (getRequestToken(request) !== expectedToken) {
      return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
    }

    const reconciliation = await reconcileRecentAwaitingMercadoPagoReservations();
    const result = await expirePendingReservations();

    return NextResponse.json({
      ...result,
      reconciliation,
    });
  } catch (error) {
    return createApiErrorResponse(error, "NÃ£o foi possÃ­vel expirar reservas pendentes.");
  }
}
