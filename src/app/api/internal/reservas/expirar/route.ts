import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/errors/app-error";
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
      console.error("[reservation-maintenance] Token interno nao configurado.");
      return NextResponse.json(
        {
          status: "configuration_error",
          error: "Token interno nao configurado.",
        },
        { status: 500 }
      );
    }

    if (getRequestToken(request) !== expectedToken) {
      console.warn("[reservation-maintenance] Chamada recusada por token invalido.");
      return NextResponse.json(
        {
          status: "unauthorized",
          error: "Nao autorizado.",
        },
        { status: 401 }
      );
    }

    const reconciliation = await reconcileRecentAwaitingMercadoPagoReservations();
    const expiration = await expirePendingReservations();

    console.info("[reservation-maintenance] Rotina executada.", {
      reconciliation,
      expiration,
    });

    return NextResponse.json({
      status: "ok",
      ...expiration,
      reconciliation,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Nao foi possivel expirar reservas pendentes.");
  }
}
