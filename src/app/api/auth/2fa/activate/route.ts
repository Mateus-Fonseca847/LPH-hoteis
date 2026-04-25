import { NextResponse } from "next/server";

import { isAdminUser, requirePendingAuthSession } from "@/lib/auth";
import { activateTwoFactorForUser } from "@/lib/auth/two-factor";
import { setAuthSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await requirePendingAuthSession();

    if (!isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")) {
      return NextResponse.json({ error: "2FA não é obrigatório para este usuário." }, { status: 400 });
    }

    if (!session.twoFactorSetupRequired) {
      return NextResponse.json({ error: "A ativação de 2FA não está pendente." }, { status: 400 });
    }

    const body = (await request.json()) as { token?: string };
    await activateTwoFactorForUser(session.sub, body.token ?? "");

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

    return NextResponse.json({ error: "Não foi possível ativar o 2FA." }, { status: 500 });
  }
}
