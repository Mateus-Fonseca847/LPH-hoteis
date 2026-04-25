import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import * as OTPAuth from "otpauth";

import { prisma } from "@/lib/prisma";

const TWO_FACTOR_ISSUER = "LPH Hoteis";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

function getTwoFactorEncryptionKey() {
  const rawKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY nao configurada.");
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
    throw new Error("Segredo de 2FA invalido.");
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
    throw new Error("Usuario nao encontrado.");
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    throw new Error("O 2FA ja foi ativado para este usuario.");
  }

  let secret = "";

  if (user.twoFactorSecret) {
    secret = decryptTwoFactorSecret(user.twoFactorSecret);
  } else {
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

  if (!user?.twoFactorSecret) {
    return false;
  }

  const normalizedToken = sanitizeTotpToken(token);

  if (normalizedToken.length !== TOTP_DIGITS) {
    return false;
  }

  const secret = decryptTwoFactorSecret(user.twoFactorSecret);
  const totp = buildTotp(secret, user.email);
  const delta = totp.validate({ token: normalizedToken, window: TOTP_WINDOW });

  return delta !== null;
}

export async function activateTwoFactorForUser(userId: string, token: string) {
  const isValid = await verifyTwoFactorTokenForUser(userId, token);

  if (!isValid) {
    throw new Error("Codigo de autenticacao invalido.");
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
    },
  });

  if (!user) {
    return false;
  }

  return user.globalRole === "super_admin" || user.globalRole === "hotel_admin"
    ? user.twoFactorEnabled
    : true;
}
