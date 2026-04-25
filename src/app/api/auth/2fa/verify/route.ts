import { NextResponse } from "next/server";

import { isAdminUser, requirePendingAuthSession } from "@/lib/auth";
import { setAuthSessionCookie } from "@/lib/auth/session";
import { verifyTwoFactorTokenForUser } from "@/lib/auth/two-factor";

export async function POST(request: Request) {
  try {
    const session = await requirePendingAuthSession();

    if (!isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")) {
      return NextResponse.json({ error: "2FA não é obrigatório para este usuário." }, { status: 400 });
    }

    if (session.twoFactorSetupRequired) {
      return NextResponse.json({ error: "Ative o 2FA antes de continuar." }, { status: 400 });
    }

    const body = (await request.json()) as { token?: string };
    const isValid = await verifyTwoFactorTokenForUser(session.sub, body.token ?? "");

    if (!isValid) {
      return NextResponse.json({ error: "Código de autenticação inválido." }, { status: 401 });
    }

    await setAuthSessionCookie({
      ...session,
      twoFactorVerified: true,
      twoFactorSetupRequired: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Não foi possível validar o 2FA." }, { status: 500 });
  }
}
