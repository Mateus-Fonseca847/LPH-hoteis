import { NextResponse } from "next/server";

import { isAdminUser, requirePendingAuthSession } from "@/lib/auth";
import { createAuthApiErrorResponse, parseTwoFactorRequestBody } from "@/lib/auth/auth-route";
import { setAuthSessionCookie } from "@/lib/auth/session";
import { activateTwoFactorForUser } from "@/lib/auth/two-factor";

export async function POST(request: Request) {
  try {
    const session = await requirePendingAuthSession();

    if (!isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")) {
      return NextResponse.json(
        { error: "2FA não é obrigatório para este usuário." },
        { status: 400 }
      );
    }

    if (!session.twoFactorSetupRequired) {
      return NextResponse.json({ error: "A ativação de 2FA não está pendente." }, { status: 400 });
    }

    const parsedBody = parseTwoFactorRequestBody(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    await activateTwoFactorForUser(session.sub, parsedBody.data.token);

    await setAuthSessionCookie({
      ...session,
      twoFactorVerified: true,
      twoFactorSetupRequired: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return createAuthApiErrorResponse(error, "Não foi possível ativar o 2FA.");
  }
}
