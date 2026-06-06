import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import * as OTPAuth from "otpauth";

import { ConflictError, InternalServerError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";

const TWO_FACTOR_ISSUER = "LPH Hotéis";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

function getTwoFactorEncryptionKey() {
  const rawKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY não configurada.");
  }

  const normalized = rawKey.trim();
  const key = Buffer.from(normalized, "base64");

  if (key.length !== 32) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY deve ter 32 bytes em base64.");
  }

  return key;
}

function sanitizeTotpToken(token: string) {
  return token.replace(/\D/g, "").slice(0, TOTP_DIGITS);
}

export function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTwoFactorEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTwoFactorSecret(encryptedSecret: string) {
  const [ivPart, authTagPart, encryptedPart] = encryptedSecret.split(".");

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Segredo de 2FA inválido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getTwoFactorEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  );

  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function buildTotp(secret: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: TWO_FACTOR_ISSUER,
    label,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function getEnabledStateError() {
  return new InternalServerError(
    "A configuração do 2FA deste usuário está inválida. Atualize o 2FA antes de continuar.",
    true
  );
}

function tryDecryptStoredSecret(encryptedSecret: string) {
  try {
    return decryptTwoFactorSecret(encryptedSecret);
  } catch (error) {
    console.error("[auth/2fa] Failed to decrypt stored secret.", error);
    return null;
  }
}

function validateTotpSecret(secret: string, label: string) {
  try {
    buildTotp(secret, label);
    return true;
  } catch (error) {
    console.error("[auth/2fa] Invalid TOTP secret format.", error);
    return false;
  }
}

function isValidTotpToken(secret: string, label: string, token: string) {
  const normalizedToken = sanitizeTotpToken(token);

  if (normalizedToken.length !== TOTP_DIGITS) {
    return false;
  }

  const totp = buildTotp(secret, label);
  const delta = totp.validate({ token: normalizedToken, window: TOTP_WINDOW });

  return delta !== null;
}

export function isTwoFactorRequiredForUser(user: {
  globalRole: "super_admin" | "hotel_admin" | "user";
  twoFactorEnabled: boolean;
}) {
  return (
    (user.globalRole === "super_admin" || user.globalRole === "hotel_admin") &&
    user.twoFactorEnabled === true
  );
}

export function getTwoFactorLoginState(user: {
  id: string;
  email: string;
  globalRole: "super_admin" | "hotel_admin" | "user";
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
}) {
  if (!isTwoFactorRequiredForUser(user)) {
    return {
      mode: "bypass" as const,
    };
  }

  if (!user.twoFactorSecret?.trim()) {
    console.error("[auth/2fa] Active 2FA user is missing stored secret.", {
      userId: user.id,
      email: user.email,
    });

    return {
      mode: "error" as const,
      error: getEnabledStateError(),
    };
  }

  const secret = tryDecryptStoredSecret(user.twoFactorSecret);

  if (!secret || !validateTotpSecret(secret, user.email)) {
    console.error("[auth/2fa] Active 2FA user has invalid stored secret.", {
      userId: user.id,
      email: user.email,
    });

    return {
      mode: "error" as const,
      error: getEnabledStateError(),
    };
  }

  return {
    mode: "verify" as const,
  };
}

export async function generateTwoFactorSetup(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  if (user.twoFactorEnabled) {
    throw new Error("O 2FA já foi ativado para este usuário.");
  }

  let secret = "";

  if (user.twoFactorSecret) {
    const decryptedSecret = tryDecryptStoredSecret(user.twoFactorSecret);

    if (decryptedSecret && validateTotpSecret(decryptedSecret, user.email)) {
      secret = decryptedSecret;
    } else {
      console.warn("[auth/2fa] Replacing stale pending 2FA secret.", {
        userId: user.id,
        email: user.email,
      });
    }
  }

  if (!secret) {
    const generated = new OTPAuth.Secret({ size: 20 });
    secret = generated.base32;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: encryptTwoFactorSecret(secret),
      },
    });
  }

  const totp = buildTotp(secret, user.email);

  return {
    otpauthUrl: totp.toString(),
    manualEntryKey: secret,
  };
}

export async function verifyTwoFactorTokenForUser(userId: string, token: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });

  if (!user) {
    console.warn("[auth/2fa] OTP verification attempted for missing user.", { userId });
    return false;
  }

  if (!user.twoFactorEnabled) {
    console.warn("[auth/2fa] OTP verification attempted for user without active 2FA.", {
      userId: user.id,
      email: user.email,
    });
    return false;
  }

  if (!user.twoFactorSecret?.trim()) {
    throw getEnabledStateError();
  }

  const secret = tryDecryptStoredSecret(user.twoFactorSecret);

  if (!secret || !validateTotpSecret(secret, user.email)) {
    throw getEnabledStateError();
  }

  return isValidTotpToken(secret, user.email, token);
}

export async function activateTwoFactorForUser(userId: string, token: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  if (user.twoFactorEnabled) {
    throw new ConflictError("O 2FA já foi ativado para este usuário.");
  }

  if (!user.twoFactorSecret?.trim()) {
    throw new InternalServerError(
      "A configuração do 2FA não foi preparada para este usuário. Gere uma nova chave antes de ativar.",
      true
    );
  }

  const secret = tryDecryptStoredSecret(user.twoFactorSecret);

  if (!secret || !validateTotpSecret(secret, user.email)) {
    throw new InternalServerError(
      "A configuração do 2FA deste usuário está inválida. Gere uma nova chave antes de ativar.",
      true
    );
  }

  const isValid = isValidTotpToken(secret, user.email, token);

  if (!isValid) {
    throw new Error("Código de autenticação inválido.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
    },
  });
}

export async function isTwoFactorConfiguredForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      globalRole: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      email: true,
      id: true,
    },
  });

  if (!user) {
    return false;
  }

  if (user.globalRole !== "super_admin" && user.globalRole !== "hotel_admin") {
    return true;
  }

  if (!user.twoFactorEnabled) {
    return true;
  }

  if (!user.twoFactorSecret?.trim()) {
    return false;
  }

  const secret = tryDecryptStoredSecret(user.twoFactorSecret);

  return Boolean(secret && validateTotpSecret(secret, user.email));
}
