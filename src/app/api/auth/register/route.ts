import { Prisma } from "@prisma/client";

import { createAuthApiErrorResponse } from "@/lib/auth/auth-route";
import { hashPassword } from "@/lib/auth/password";
import { createApiSuccessResponse, ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { parseSignupPayload } from "@/lib/validations/signup";

const SIGNUP_FAILURE_MESSAGE = "Nao foi possivel criar a conta com os dados informados.";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Dados de cadastro invalidos.");
    }

    const parsedPayload = parseSignupPayload(body);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    const { name, email, password } = parsedPayload.data;
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ValidationError(SIGNUP_FAILURE_MESSAGE);
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        globalRole: "user",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    return createApiSuccessResponse(
      {
        message: "Conta criada com sucesso. Acesse com seu e-mail e senha.",
        redirectTo: "/login",
      },
      201
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return createAuthApiErrorResponse(
        new ValidationError(SIGNUP_FAILURE_MESSAGE),
        SIGNUP_FAILURE_MESSAGE
      );
    }

    return createAuthApiErrorResponse(error, SIGNUP_FAILURE_MESSAGE);
  }
}
