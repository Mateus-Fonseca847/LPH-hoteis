import { NextResponse } from "next/server";

import {
  createAuthApiErrorResponse,
  createValidationErrorFromResult,
  parseLoginRequestBody,
} from "@/lib/auth/auth-route";
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
import { createApiSuccessResponse } from "@/lib/errors/app-error";

export async function POST(request: Request) {
  try {
    const parsedBody = parseLoginRequestBody(await request.json());

    if (!parsedBody.success) {
      throw createValidationErrorFromResult(parsedBody);
    }

    const email = parsedBody.data.email.trim().toLowerCase();
    const password = parsedBody.data.password;
    const ip = getClientIp(request);
    const rateLimit = isLoginRateLimited({ email, ip });

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível concluir o login com essas credenciais.",
          code: "AUTHENTICATION_ERROR",
        },
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

      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível concluir o login com essas credenciais.",
          code: "AUTHENTICATION_ERROR",
        },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      recordFailedLoginAttempt({ email, ip });

      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível concluir o login com essas credenciais.",
          code: "AUTHENTICATION_ERROR",
        },
        { status: 401 }
      );
    }

    clearFailedLoginAttempts({ email, ip });

    if (isAdminUser(user.globalRole)) {
      await setPendingTwoFactorSessionCookie({
        sub: user.id,
        globalRole: user.globalRole,
        twoFactorSetupRequired: !user.twoFactorEnabled,
      });

      return createApiSuccessResponse({
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

    return createApiSuccessResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
      },
    });
  } catch (error) {
    return createAuthApiErrorResponse(error, "Não foi possível concluir o login.");
  }
}
