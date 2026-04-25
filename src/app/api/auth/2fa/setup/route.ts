import { NextResponse } from "next/server";

import { isAdminUser, requirePendingAuthSession } from "@/lib/auth";
import { generateTwoFactorSetup } from "@/lib/auth/two-factor";

export async function POST() {
  try {
    const session = await requirePendingAuthSession();

    if (!isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")) {
      return NextResponse.json({ error: "2FA não é obrigatório para este usuário." }, { status: 400 });
    }

    if (!session.twoFactorSetupRequired) {
      return NextResponse.json({ error: "A ativação de 2FA não está pendente." }, { status: 400 });
    }

    const setup = await generateTwoFactorSetup(session.sub);

    return NextResponse.json({
      ok: true,
      otpauthUrl: setup.otpauthUrl,
      manualEntryKey: setup.manualEntryKey,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Não foi possível preparar o 2FA." }, { status: 500 });
  }
}
