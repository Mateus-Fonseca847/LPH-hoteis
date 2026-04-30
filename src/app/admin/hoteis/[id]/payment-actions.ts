"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getErrorMessage, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  getRequestIpAddress,
  parseHotelRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/encryption";
import { parsePaymentSettingsFormData } from "@/lib/validations/payment-settings";

const PAYMENT_SECRETS_KEY_ENV = "PAYMENT_SECRETS_ENCRYPTION_KEY";

export type HotelPaymentSettingsState = {
  status: "idle" | "success" | "error";
  message: string;
};

type PaymentSettingsAuditSnapshot = {
  provider: "manual" | "mercado_pago";
  isEnabled: boolean;
  receiverLabel: string;
  publicKey: string | null;
  hasAccessToken: boolean;
  pixKey: string | null;
  payoutDocument: string | null;
};

function buildSnapshot(settings: PaymentSettingsAuditSnapshot) {
  return settings;
}

export async function updateHotelPaymentSettingsAction(
  hotelId: string,
  _previousState: HotelPaymentSettingsState,
  formData: FormData
): Promise<HotelPaymentSettingsState> {
  try {
    const parsedParams = parseHotelRouteParams({ hotelId });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const safeHotelId = parsedParams.data.hotelId;
    const user = await requireAuthorizedHotelWrite(safeHotelId);
    const parsedPayload = parsePaymentSettingsFormData(formData);

    if (!parsedPayload.success) {
      throw new ValidationError(parsedPayload.error);
    }

    const payload = parsedPayload.data;
    const currentSettings = await prisma.hotelPaymentSettings.findUnique({
      where: {
        hotelId: safeHotelId,
      },
    });

    if (!currentSettings) {
      const hotel = await prisma.hotel.findUnique({
        where: {
          id: safeHotelId,
        },
        select: {
          id: true,
        },
      });

      if (!hotel) {
        throw new NotFoundError("Hotel não encontrado.");
      }
    }

    if (
      payload.provider === "mercado_pago" &&
      payload.isEnabled &&
      !payload.accessToken &&
      !currentSettings?.encryptedAccessToken
    ) {
      throw new ValidationError("Informe o access token de teste do Mercado Pago para ativar.");
    }

    const encryptedAccessToken = payload.accessToken
      ? encryptSecret(payload.accessToken, PAYMENT_SECRETS_KEY_ENV)
      : (currentSettings?.encryptedAccessToken ?? null);
    const previousValue = currentSettings
      ? buildSnapshot({
          provider: currentSettings.provider,
          isEnabled: currentSettings.isEnabled,
          receiverLabel: currentSettings.receiverLabel,
          publicKey: currentSettings.publicKey,
          hasAccessToken: Boolean(currentSettings.encryptedAccessToken),
          pixKey: currentSettings.pixKey,
          payoutDocument: currentSettings.payoutDocument,
        })
      : null;
    const nextValue = buildSnapshot({
      provider: payload.provider,
      isEnabled: payload.isEnabled,
      receiverLabel: payload.receiverLabel,
      publicKey: payload.publicKey,
      hasAccessToken: Boolean(encryptedAccessToken),
      pixKey: payload.pixKey,
      payoutDocument: payload.payoutDocument,
    });
    const changedFields = Object.keys(nextValue).filter((key) => {
      if (!previousValue) {
        return true;
      }

      const field = key as keyof PaymentSettingsAuditSnapshot;

      return previousValue[field] !== nextValue[field];
    });

    const requestHeaders = await headers();
    const ipAddress = getRequestIpAddress(requestHeaders);

    await prisma.$transaction(async (tx) => {
      await tx.hotelPaymentSettings.upsert({
        where: {
          hotelId: safeHotelId,
        },
        create: {
          hotelId: safeHotelId,
          provider: payload.provider,
          isEnabled: payload.isEnabled,
          receiverLabel: payload.receiverLabel,
          publicKey: payload.publicKey,
          encryptedAccessToken,
          pixKey: payload.pixKey,
          payoutDocument: payload.payoutDocument,
        },
        update: {
          provider: payload.provider,
          isEnabled: payload.isEnabled,
          receiverLabel: payload.receiverLabel,
          publicKey: payload.publicKey,
          encryptedAccessToken,
          pixKey: payload.pixKey,
          payoutDocument: payload.payoutDocument,
        },
      });

      if (changedFields.length > 0) {
        await tx.hotelAuditLog.create({
          data: {
            userId: user.id,
            hotelId: safeHotelId,
            action: "hotel.payment_settings.updated",
            changedFields,
            previousValue: previousValue ?? {},
            newValue: nextValue,
            ipAddress,
          },
        });
      }
    });

    revalidatePath(`/admin/hoteis/${safeHotelId}`);

    return {
      status: "success",
      message: "Configurações de pagamento salvas com segurança.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Não foi possível salvar os pagamentos."),
    };
  }
}
