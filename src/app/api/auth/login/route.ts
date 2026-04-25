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
import {
  clearAuthSessionCookie,
  setAuthSessionCookie,
  setPendingTwoFactorSessionCookie,
} from "@/lib/auth/session";
import { getTwoFactorLoginState } from "@/lib/auth/two-factor";
import { findUserByEmail } from "@/lib/auth/user";
import { InternalServerError, createApiSuccessResponse } from "@/lib/errors/app-error";

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
      console.warn("[auth/login] User not found.", { email, ip });
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
      console.warn("[auth/login] Invalid password.", { email, userId: user.id, ip });
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
      const twoFactorState = getTwoFactorLoginState(user);

      if (twoFactorState.mode === "error") {
        await clearAuthSessionCookie();
        throw twoFactorState.error;
      }

      if (twoFactorState.mode === "verify") {
        console.info("[auth/login] Pending 2FA verification required.", {
          userId: user.id,
          email: user.email,
        });

        await setPendingTwoFactorSessionCookie({
          sub: user.id,
          globalRole: user.globalRole,
          twoFactorSetupRequired: false,
        });

        return createApiSuccessResponse({
          requiresTwoFactor: true,
          requiresTwoFactorSetup: false,
        });
      }

      console.info("[auth/login] Admin login without active 2FA.", {
        userId: user.id,
        email: user.email,
      });

      await clearAuthSessionCookie();
      await setAuthSessionCookie({
        sub: user.id,
        globalRole: user.globalRole,
        twoFactorVerified: true,
        twoFactorSetupRequired: false,
      });

      return createApiSuccessResponse({
        requiresTwoFactor: false,
        requiresTwoFactorSetup: false,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          globalRole: user.globalRole,
        },
      });
    }

    await clearAuthSessionCookie();
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
    console.error("[auth/login] Failed to complete login.", error);

    if (error instanceof Error && error.name === "PrismaClientInitializationError") {
      return createAuthApiErrorResponse(
        new InternalServerError("Database configuration error."),
        "Não foi possível concluir o login."
      );
    }

    return createAuthApiErrorResponse(error, "Não foi possível concluir o login.");
  }
}
