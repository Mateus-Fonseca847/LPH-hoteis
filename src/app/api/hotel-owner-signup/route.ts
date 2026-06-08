import { createPendingHotelOwnerSignupRequest } from "@/lib/hotel-owner-signup";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";

const SUCCESS_MESSAGE = "Solicitação enviada com sucesso. A equipe LPH analisará seu cadastro.";
const FAILURE_MESSAGE = "Não foi possível enviar a solicitação.";

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Payload inválido.");
    }

    const signupRequest = await createPendingHotelOwnerSignupRequest(body);

    return createApiSuccessResponse(
      {
        message: SUCCESS_MESSAGE,
        request: signupRequest,
      },
      201
    );
  } catch (error) {
    return createApiErrorResponse(error, FAILURE_MESSAGE);
  }
}
