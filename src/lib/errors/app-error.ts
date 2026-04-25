import { NextResponse } from "next/server";

type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

type ApiErrorResponseBody = {
  ok: false;
  error: string;
  code: AppErrorCode;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly exposeMessage: boolean;

  constructor(
    message: string,
    {
      statusCode,
      code,
      exposeMessage = true,
    }: {
      statusCode: number;
      code: AppErrorCode;
      exposeMessage?: boolean;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.exposeMessage = exposeMessage;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Payload inválido.") {
    super(message, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Sessão inválida ou expirada.") {
    super(message, {
      statusCode: 401,
      code: "AUTHENTICATION_ERROR",
    });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Acesso negado.") {
    super(message, {
      statusCode: 403,
      code: "AUTHORIZATION_ERROR",
    });
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, {
      statusCode: 404,
      code: "NOT_FOUND",
    });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito de dados.") {
    super(message, {
      statusCode: 409,
      code: "CONFLICT",
    });
    this.name = "ConflictError";
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Erro interno.", exposeMessage = false) {
    super(message, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      exposeMessage,
    });
    this.name = "InternalServerError";
  }
}

function getSafeErrorMessage(error: AppError, fallbackMessage: string) {
  return error.exposeMessage ? error.message : fallbackMessage;
}

export function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return getSafeErrorMessage(error, fallbackMessage);
  }

  if (error instanceof Error) {
    return process.env.NODE_ENV === "production" ? fallbackMessage : error.message;
  }

  return fallbackMessage;
}

export function createApiSuccessResponse<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      ...data,
    },
    { status }
  );
}

export function createApiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    const body: ApiErrorResponseBody = {
      ok: false,
      error: getSafeErrorMessage(error, fallbackMessage),
      code: error.code,
    };

    return NextResponse.json(body, { status: error.statusCode });
  }

  const body: ApiErrorResponseBody = {
    ok: false,
    error:
      process.env.NODE_ENV === "production"
        ? fallbackMessage
        : error instanceof Error
          ? error.message
          : fallbackMessage,
    code: "INTERNAL_SERVER_ERROR",
  };

  return NextResponse.json(body, { status: 500 });
}
