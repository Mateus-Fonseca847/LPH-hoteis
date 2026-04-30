import { NextResponse } from "next/server";

import { isAdminUser, requirePendingAuthSession } from "@/lib/auth";
import { createAuthApiErrorResponse } from "@/lib/auth/auth-route";
import { requestTwoFactorEmailCodeForUser } from "@/lib/auth/email-two-factor";
import { createApiSuccessResponse } from "@/lib/errors/app-error";

const GENERIC_RESPONSE_MESSAGE =
  "Se for possível validar este acesso, enviaremos um código para o e-mail cadastrado.";
const PENDING_2FA_REQUIRED_MESSAGE = "Login com 2FA pendente é necessário para reenviar o código.";
const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde antes de solicitar um novo código.";

function createStandardErrorResponse({
  error,
  code,
  status,
  retryAfterSeconds,
}: {
  error: string;
  code: "AUTHENTICATION_ERROR" | "RATE_LIMIT";
  status: number;
  retryAfterSeconds?: number;
}) {
  return NextResponse.json(
    {
      ok: false,
      error,
      code,
    },
    {
      status,
      headers: retryAfterSeconds
        ? {
            "Retry-After": String(retryAfterSeconds),
          }
        : undefined,
    }
  );
}

export async function POST() {
  try {
    const session = await requirePendingAuthSession();
    const isPendingAdminTwoFactor =
      !session.twoFactorVerified &&
      !session.twoFactorSetupRequired &&
      isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user");

    if (!isPendingAdminTwoFactor) {
      return createStandardErrorResponse({
        error: PENDING_2FA_REQUIRED_MESSAGE,
        code: "AUTHENTICATION_ERROR",
        status: 401,
      });
    }

    const result = await requestTwoFactorEmailCodeForUser(session.sub);

    if (result.retryAfterSeconds) {
      return createStandardErrorResponse({
        error: RATE_LIMIT_MESSAGE,
        code: "RATE_LIMIT",
        status: 429,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    if (!result.sent) {
      return createStandardErrorResponse({
        error: PENDING_2FA_REQUIRED_MESSAGE,
        code: "AUTHENTICATION_ERROR",
        status: 401,
      });
    }

    return createApiSuccessResponse({
      message: GENERIC_RESPONSE_MESSAGE,
    });
  } catch (error) {
    return createAuthApiErrorResponse(error, "Não foi possível enviar o código de verificação.");
  }
}
