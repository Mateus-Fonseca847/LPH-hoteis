import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { setAuthSessionCookie } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/user";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    await setAuthSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir o login." },
      { status: 500 }
    );
  }
}
