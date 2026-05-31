import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  createApiErrorResponse,
  createApiSuccessResponse,
  ValidationError,
} from "@/lib/errors/app-error";
import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";

const WEBHOOK_FAILURE_MESSAGE = "Nao foi possivel processar o webhook de pagamento.";

const mercadoPagoWebhookPayloadSchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    data: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
  })
  .passthrough();

type MercadoPagoWebhookPayload = z.infer<typeof mercadoPagoWebhookPayloadSchema>;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ValidationError(`${name} nao configurado.`);
  }

  return value;
}

function parseSignature(signature: string) {
  return Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");

      return [key?.trim(), value?.trim()];
    })
  );
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

function validateMercadoPagoSignature(request: Request, paymentId: string) {
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const secret =
    process.env.PAYMENT_WEBHOOK_SECRET?.trim() || getRequiredEnv("MERCADO_PAGO_WEBHOOK_SECRET");

  if (!signature || !requestId) {
    throw new ValidationError("Assinatura do webhook ausente.");
  }

  const parsedSignature = parseSignature(signature);
  const timestamp = parsedSignature.ts;
  const expectedSignature = parsedSignature.v1;

  if (!timestamp || !expectedSignature) {
    throw new ValidationError("Assinatura do webhook invalida.");
  }

  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const calculatedSignature = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeCompare(calculatedSignature, expectedSignature)) {
    throw new ValidationError("Assinatura do webhook invalida.");
  }
}

function getPaymentId(payload: MercadoPagoWebhookPayload, request: Request) {
  const url = new URL(request.url);
  const queryPaymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const payloadPaymentId = payload.data?.id;
  const paymentId = queryPaymentId || (payloadPaymentId ? String(payloadPaymentId) : "");

  if (!paymentId) {
    throw new ValidationError("Pagamento nao informado no webhook.");
  }

  return paymentId;
}

function isPaymentEvent(payload: MercadoPagoWebhookPayload) {
  return payload.type === "payment" || payload.action?.startsWith("payment.");
}

export async function POST(request: Request) {
  try {
    const payloadResult = mercadoPagoWebhookPayloadSchema.safeParse(
      await request.json().catch(() => null)
    );

    if (!payloadResult.success) {
      throw new ValidationError("Payload do webhook invalido.");
    }

    const payload = payloadResult.data;
    const paymentId = getPaymentId(payload, request);

    validateMercadoPagoSignature(request, paymentId);

    if (!isPaymentEvent(payload)) {
      return createApiSuccessResponse({
        received: true,
      });
    }

    await syncMercadoPagoPayment({
      paymentId,
      source: "webhook",
    });

    return createApiSuccessResponse({
      received: true,
    });
  } catch (error) {
    return createApiErrorResponse(error, WEBHOOK_FAILURE_MESSAGE);
  }
}
