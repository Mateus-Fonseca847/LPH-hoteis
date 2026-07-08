import { Prisma } from "@prisma/client";
import { ZodError, type ZodIssue } from "zod";

const FALLBACK_ERROR_MESSAGE = "Não foi possível concluir a operação.";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Verifique os dados informados.",
  401: "Sua sessão expirou. Faça login novamente.",
  403: "Você não tem permissão para realizar esta ação.",
  404: "Registro não encontrado.",
  409: "Já existe um registro com estes dados.",
  422: "Verifique os dados informados.",
  500: "Não foi possível concluir a operação.",
};

function isTechnicalMessage(message: string) {
  return /too big|too small|expected|required|invalid|prisma|zod|constraint|stack|payload|unique/i.test(
    message
  );
}

function formatPath(issue: { path?: Array<string | number | symbol> }) {
  return issue.path?.at(-1)?.toString();
}

export function getZodIssueMessage(issue: Partial<ZodIssue> & { message?: string }) {
  if (issue.message && !isTechnicalMessage(issue.message)) {
    return issue.message;
  }

  const field = formatPath(issue);
  const label = field ? `O campo ${field}` : "Este campo";
  const issueData = issue as Partial<ZodIssue> & {
    origin?: string;
    maximum?: number | bigint;
    minimum?: number | bigint;
  };

  switch (issue.code) {
    case "invalid_type":
      return `${label} é obrigatório.`;
    case "too_big":
      if (issueData.origin === "string") {
        return `${label} pode ter no máximo ${issueData.maximum} caracteres.`;
      }
      return `${label} excede o limite permitido.`;
    case "too_small":
      if (issueData.origin === "string") {
        return `${label} deve possuir pelo menos ${issueData.minimum} caracteres.`;
      }
      return `${label} está abaixo do mínimo permitido.`;
    case "invalid_format":
      return `${label} possui formato inválido.`;
    case "invalid_value":
      return `${label} possui valor inválido.`;
    case "unrecognized_keys":
      return "O formulário possui campos inválidos.";
    default:
      return "Verifique os dados informados.";
  }
}

export function getZodErrorMessage(
  error: ZodError,
  fallbackMessage = "Verifique os dados informados."
) {
  return error.issues[0] ? getZodIssueMessage(error.issues[0]) : fallbackMessage;
}

export function getPrismaErrorMessage(error: unknown, fallbackMessage = FALLBACK_ERROR_MESSAGE) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "Já existe um registro com estes dados.";
    }

    if (error.code === "P2025") {
      return "Registro não encontrado.";
    }

    if (error.code === "P2003") {
      return "Não foi possível concluir a operação por causa de registros vinculados.";
    }

    return fallbackMessage;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return "Verifique os dados informados.";
  }

  return null;
}

export function getHttpErrorMessage(status: number, fallbackMessage = FALLBACK_ERROR_MESSAGE) {
  return STATUS_MESSAGES[status] ?? fallbackMessage;
}

export function getFriendlyErrorMessage(error: unknown, fallbackMessage = FALLBACK_ERROR_MESSAGE) {
  if (error instanceof ZodError) {
    return getZodErrorMessage(error, fallbackMessage);
  }

  const prismaMessage = getPrismaErrorMessage(error, fallbackMessage);

  if (prismaMessage) {
    return prismaMessage;
  }

  if (error instanceof TypeError) {
    return "Não foi possível conectar ao servidor. Tente novamente.";
  }

  return fallbackMessage;
}
