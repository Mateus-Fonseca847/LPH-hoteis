import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email";
import { ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";

const PASSWORD_RESET_PURPOSE = "password_reset";
const PASSWORD_RESET_EXPIRES_IN_MINUTES = 30;
const TOKEN_SECRET_BYTES = 32;
export const PASSWORD_RESET_NEUTRAL_MESSAGE =
  "Se este e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.";

function getTokenPepper() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }

  return secret;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function hashPasswordResetSecret(secret: string) {
  return createHmac("sha256", getTokenPepper()).update(secret).digest("hex");
}

function safeCompareHash(expectedHash: string, receivedHash: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(receivedHash, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

function buildResetUrl(baseUrl: string, token: string) {
  const url = new URL("/redefinir-senha", baseUrl);
  url.searchParams.set("token", token);

  return url.toString();
}

function parseResetToken(token: string) {
  const [tokenId, secret, extra] = token.trim().split(".");

  if (!tokenId || !secret || extra) {
    return null;
  }

  return { tokenId, secret };
}

export async function requestPasswordReset(email: string, baseUrl: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
    },
  });

  if (!user?.isActive) {
    return { message: PASSWORD_RESET_NEUTRAL_MESSAGE };
  }

  const now = new Date();
  const secret = randomBytes(TOKEN_SECRET_BYTES).toString("base64url");
  const tokenHash = hashPasswordResetSecret(secret);

  await prisma.emailAuthCode.updateMany({
    where: {
      userId: user.id,
      purpose: PASSWORD_RESET_PURPOSE,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  });

  const createdToken = await prisma.emailAuthCode.create({
    data: {
      userId: user.id,
      purpose: PASSWORD_RESET_PURPOSE,
      codeHash: tokenHash,
      expiresAt: addMinutes(now, PASSWORD_RESET_EXPIRES_IN_MINUTES),
    },
    select: {
      id: true,
    },
  });

  const token = `${createdToken.id}.${secret}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: buildResetUrl(baseUrl, token),
      expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
    });
  } catch (error) {
    await prisma.emailAuthCode.delete({
      where: {
        id: createdToken.id,
      },
    });

    throw error;
  }

  return { message: PASSWORD_RESET_NEUTRAL_MESSAGE };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const parsedToken = parseResetToken(token);

  if (!parsedToken) {
    throw new ValidationError("Link de redefinição inválido ou expirado.");
  }

  const now = new Date();
  const resetToken = await prisma.emailAuthCode.findUnique({
    where: {
      id: parsedToken.tokenId,
    },
    select: {
      id: true,
      userId: true,
      codeHash: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !resetToken ||
    resetToken.purpose !== PASSWORD_RESET_PURPOSE ||
    resetToken.usedAt ||
    resetToken.expiresAt <= now ||
    !resetToken.user.isActive
  ) {
    throw new ValidationError("Link de redefinição inválido ou expirado.");
  }

  const receivedHash = hashPasswordResetSecret(parsedToken.secret);

  if (!safeCompareHash(resetToken.codeHash, receivedHash)) {
    throw new ValidationError("Link de redefinição inválido ou expirado.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const markedToken = await tx.emailAuthCode.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    if (markedToken.count !== 1) {
      throw new ValidationError("Link de redefinição inválido ou expirado.");
    }

    await tx.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        passwordHash,
      },
      select: {
        id: true,
      },
    });
  });

  return { message: "Senha redefinida com sucesso. Faça login para continuar." };
}
