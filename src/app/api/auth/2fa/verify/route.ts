import { NextResponse } from "next/server";

import { isAdminUser, requirePendingAuthSession } from "@/lib/auth";
import { createAuthApiErrorResponse, parseTwoFactorRequestBody } from "@/lib/auth/auth-route";
import { verifyTwoFactorEmailCodeForUser } from "@/lib/auth/email-two-factor";
import { setAuthSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await requirePendingAuthSession();

    if (!isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")) {
      return NextResponse.json(
        { error: "2FA não é obrigatório para este usuário." },
        { status: 400 }
      );
    }

    if (session.twoFactorSetupRequired) {
      return NextResponse.json({ error: "Ative o 2FA antes de continuar." }, { status: 400 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Informe o código recebido por e-mail." }, { status: 400 });
    }

    const parsedBody = parseTwoFactorRequestBody(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    const verification = await verifyTwoFactorEmailCodeForUser({
      userId: session.sub,
      code: parsedBody.data.token,
    });

    if (!verification.valid) {
      if (verification.reason === "expired") {
        return NextResponse.json(
          { error: "Código expirado. Solicite um novo código." },
          { status: 401 }
        );
      }

      if (verification.reason === "too_many_attempts") {
        return NextResponse.json(
          { error: "Muitas tentativas. Solicite um novo código." },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: "Código inválido." }, { status: 401 });
    }

    await setAuthSessionCookie({
      ...session,
      twoFactorVerified: true,
      twoFactorSetupRequired: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return createAuthApiErrorResponse(error, "Não foi possível validar o 2FA.");
  }
}
