const TECHNICAL_ERROR_PATTERN =
  /too big|too small|expected|required|invalid|prisma|zod|constraint|stack|payload|syntaxerror|typeerror/i;

export function getClientErrorMessage(
  error: unknown,
  fallbackMessage = "Não foi possível concluir a operação."
) {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (!error.message || TECHNICAL_ERROR_PATTERN.test(error.message)) {
    return fallbackMessage;
  }

  return error.message;
}
