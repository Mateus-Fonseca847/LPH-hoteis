import { createAuthApiErrorResponse, createValidationErrorFromResult } from "@/lib/auth/auth-route";
import { PASSWORD_RESET_NEUTRAL_MESSAGE, requestPasswordReset } from "@/lib/auth/password-reset";
import { createApiSuccessResponse, ValidationError } from "@/lib/errors/app-error";
import { parsePasswordResetRequestPayload } from "@/lib/validations/password-reset";

const PASSWORD_RESET_FAILURE_MESSAGE = "Não foi possível solicitar a redefinição de senha.";

function getBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Payload inválido.");
    }

    const parsedPayload = parsePasswordResetRequestPayload(body);

    if (!parsedPayload.success) {
      throw createValidationErrorFromResult(parsedPayload);
    }

    await requestPasswordReset(parsedPayload.data.email, getBaseUrl(request));

    return createApiSuccessResponse({
      message: PASSWORD_RESET_NEUTRAL_MESSAGE,
    });
  } catch (error) {
    return createAuthApiErrorResponse(error, PASSWORD_RESET_FAILURE_MESSAGE);
  }
}
