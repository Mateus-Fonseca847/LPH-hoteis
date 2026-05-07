import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { createMarketingSubscriber } from "@/lib/marketing-subscribers";

const SUBSCRIBE_FAILURE = "Não foi possível realizar o cadastro. Tente novamente.";
const allowedPayloadKeys = new Set(["email", "consentAccepted"]);

function parsePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Payload inválido.");
  }

  const data = payload as Record<string, unknown>;
  const unexpectedKey = Object.keys(data).find((key) => !allowedPayloadKeys.has(key));

  if (unexpectedKey) {
    throw new ValidationError("Payload inválido.");
  }

  return {
    email: data.email,
    consentAccepted: data.consentAccepted,
  };
}

export async function POST(request: Request) {
  try {
    const payload = parsePayload(await request.json().catch(() => null));
    const subscriber = await createMarketingSubscriber(payload);

    return createApiSuccessResponse({
      subscriber,
      message: "Cadastro realizado. Você poderá receber promoções da LPH.",
    });
  } catch (error) {
    return createApiErrorResponse(error, SUBSCRIBE_FAILURE);
  }
}
