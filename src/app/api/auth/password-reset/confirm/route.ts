import { createAuthApiErrorResponse, createValidationErrorFromResult } from "@/lib/auth/auth-route";
import { resetPasswordWithToken } from "@/lib/auth/password-reset";
import { createApiSuccessResponse, ValidationError } from "@/lib/errors/app-error";
import { parsePasswordResetConfirmPayload } from "@/lib/validations/password-reset";

const PASSWORD_RESET_FAILURE_MESSAGE = "Não foi possível redefinir a senha.";

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Payload inválido.");
    }

    const parsedPayload = parsePasswordResetConfirmPayload(body);

    if (!parsedPayload.success) {
      throw createValidationErrorFromResult(parsedPayload);
    }

    const result = await resetPasswordWithToken(
      parsedPayload.data.token,
      parsedPayload.data.password
    );

    return createApiSuccessResponse({
      message: result.message,
      redirectTo: "/login",
    });
  } catch (error) {
    return createAuthApiErrorResponse(error, PASSWORD_RESET_FAILURE_MESSAGE);
  }
}
