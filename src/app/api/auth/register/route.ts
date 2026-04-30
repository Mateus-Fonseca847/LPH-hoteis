import { Prisma } from "@prisma/client";

import { createAuthApiErrorResponse } from "@/lib/auth/auth-route";
import { hashPassword } from "@/lib/auth/password";
import { createApiSuccessResponse, ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { parseSignupPayload } from "@/lib/validations/signup";

const SIGNUP_FAILURE_MESSAGE = "Não foi possível criar a conta com os dados informados.";
const DUPLICATE_EMAIL_MESSAGE = "Este e-mail já está cadastrado.";
const VALIDATION_MESSAGE = "Revise os dados informados.";
const SIGNUP_SUCCESS_MESSAGE = "Conta criada com sucesso. Faça login para continuar.";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ValidationError(VALIDATION_MESSAGE);
    }

    const parsedPayload = parseSignupPayload(body);

    if (!parsedPayload.success) {
      throw new ValidationError(VALIDATION_MESSAGE);
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
      throw new ValidationError(DUPLICATE_EMAIL_MESSAGE);
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
        message: SIGNUP_SUCCESS_MESSAGE,
        redirectTo: "/login?cadastro=sucesso",
      },
      201
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return createAuthApiErrorResponse(
        new ValidationError(DUPLICATE_EMAIL_MESSAGE),
        SIGNUP_FAILURE_MESSAGE
      );
    }

    return createAuthApiErrorResponse(error, SIGNUP_FAILURE_MESSAGE);
  }
}
