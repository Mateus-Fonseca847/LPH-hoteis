import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth";
import {
  clearFailedLoginAttempts,
  getClientIp,
  isLoginRateLimited,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { setAuthSessionCookie, setPendingTwoFactorSessionCookie } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/user";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const ip = getClientIp(request);

    if (!email || !password) {
      return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    const rateLimit = isLoginRateLimited({ email, ip });

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Não foi possível concluir o login com essas credenciais." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const user = await findUserByEmail(email);

    if (!user) {
      recordFailedLoginAttempt({ email, ip });
      return NextResponse.json({ error: "Não foi possível concluir o login com essas credenciais." }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      recordFailedLoginAttempt({ email, ip });
      return NextResponse.json({ error: "Não foi possível concluir o login com essas credenciais." }, { status: 401 });
    }

    clearFailedLoginAttempts({ email, ip });

    if (isAdminUser(user.globalRole)) {
      await setPendingTwoFactorSessionCookie({
        sub: user.id,
        globalRole: user.globalRole,
        twoFactorSetupRequired: !user.twoFactorEnabled,
      });

      return NextResponse.json({
        ok: true,
        requiresTwoFactor: user.twoFactorEnabled,
        requiresTwoFactorSetup: !user.twoFactorEnabled,
      });
    }

    await setAuthSessionCookie({
      sub: user.id,
      globalRole: user.globalRole,
      twoFactorVerified: true,
      twoFactorSetupRequired: false,
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
    return NextResponse.json({ error: "Não foi possível concluir o login." }, { status: 500 });
  }
}
