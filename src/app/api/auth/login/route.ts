import { Prisma } from "@prisma/client";
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
import { requestTwoFactorEmailCodeForUser } from "@/lib/auth/email-two-factor";
import { findUserByEmail } from "@/lib/auth/user";
import { EmailSendError } from "@/lib/email";
import { InternalServerError, createApiSuccessResponse } from "@/lib/errors/app-error";

const INVALID_CREDENTIALS_MESSAGE = "Não foi possível concluir o login com os dados informados.";
const LOGIN_FAILURE_MESSAGE = "Não foi possível concluir o login.";
const TWO_FACTOR_EMAIL_FAILURE_MESSAGE =
  "Não foi possível enviar o código de verificação. Tente novamente em alguns instantes.";

function isPrismaRuntimeError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw createValidationErrorFromResult({
        error: {
          issues: [{ message: "Payload inválido." }],
        },
      });
    }

    const parsedBody = parseLoginRequestBody(body);

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
          error: INVALID_CREDENTIALS_MESSAGE,
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
          error: INVALID_CREDENTIALS_MESSAGE,
          code: "AUTHENTICATION_ERROR",
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      console.warn("[auth/login] Inactive user attempted login.", { email, userId: user.id, ip });
      recordFailedLoginAttempt({ email, ip });

      return NextResponse.json(
        {
          ok: false,
          error: INVALID_CREDENTIALS_MESSAGE,
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
          error: INVALID_CREDENTIALS_MESSAGE,
          code: "AUTHENTICATION_ERROR",
        },
        { status: 401 }
      );
    }

    clearFailedLoginAttempts({ email, ip });
    await clearAuthSessionCookie();

    if (isAdminUser(user.globalRole)) {
      if (!user.emailTwoFactorEnabled) {
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
      }

      const twoFactorRequest = await requestTwoFactorEmailCodeForUser(user.id);

      if (twoFactorRequest.retryAfterSeconds) {
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

      if (!twoFactorRequest.sent) {
        return NextResponse.json(
          {
            ok: false,
            error: LOGIN_FAILURE_MESSAGE,
            code: "AUTHENTICATION_ERROR",
          },
          { status: 401 }
        );
      }

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

    if (error instanceof EmailSendError) {
      return NextResponse.json(
        {
          ok: false,
          error: TWO_FACTOR_EMAIL_FAILURE_MESSAGE,
          code: "AUTHENTICATION_ERROR",
        },
        { status: 503 }
      );
    }

    if (isPrismaRuntimeError(error)) {
      return createAuthApiErrorResponse(
        new InternalServerError("Database configuration error."),
        LOGIN_FAILURE_MESSAGE
      );
    }

    return createAuthApiErrorResponse(error, LOGIN_FAILURE_MESSAGE);
  }
}
