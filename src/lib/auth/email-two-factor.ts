import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { sendTwoFactorCodeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export type EmailAuthCodePurpose = "login_2fa" | "email_verification" | "password_reset";

const LOGIN_TWO_FACTOR_PURPOSE: EmailAuthCodePurpose = "login_2fa";
const CODE_DIGITS = 6;
const CODE_EXPIRES_IN_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_WINDOW_MINUTES = 10;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;

type RequestTwoFactorEmailCodeResult = {
  sent: boolean;
  retryAfterSeconds?: number;
};

type VerifyTwoFactorEmailCodeResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason: "expired" | "invalid" | "too_many_attempts";
    };

function getCodePepper() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }

  return secret;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function getSecondsUntil(date: Date, now = new Date()) {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

function isValidNumericCode(code: string) {
  return new RegExp(`^\\d{${CODE_DIGITS}}$`).test(code);
}

export function generateSixDigitEmailCode() {
  return randomInt(0, 10 ** CODE_DIGITS)
    .toString()
    .padStart(CODE_DIGITS, "0");
}

export function hashEmailAuthCode({
  userId,
  purpose,
  code,
}: {
  userId: string;
  purpose: EmailAuthCodePurpose;
  code: string;
}) {
  return createHmac("sha256", getCodePepper()).update(`${userId}:${purpose}:${code}`).digest("hex");
}

function safeCompareHash(expectedHash: string, receivedHash: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(receivedHash, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function getResendLimit(userId: string, purpose: EmailAuthCodePurpose, now: Date) {
  const windowStart = addMinutes(now, -RESEND_WINDOW_MINUTES);
  const recentCodes = await prisma.emailAuthCode.findMany({
    where: {
      userId,
      purpose,
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_SENDS_PER_WINDOW,
  });

  const lastCode = recentCodes[0];

  if (lastCode) {
    const cooldownEndsAt = addSeconds(lastCode.createdAt, RESEND_COOLDOWN_SECONDS);

    if (cooldownEndsAt > now) {
      return {
        limited: true,
        retryAfterSeconds: getSecondsUntil(cooldownEndsAt, now),
      };
    }
  }

  if (recentCodes.length >= MAX_SENDS_PER_WINDOW) {
    const oldestCode = recentCodes.at(-1);
    const windowEndsAt = oldestCode ? addMinutes(oldestCode.createdAt, RESEND_WINDOW_MINUTES) : now;

    return {
      limited: true,
      retryAfterSeconds: getSecondsUntil(windowEndsAt, now),
    };
  }

  return {
    limited: false,
  };
}

export async function requestTwoFactorEmailCodeForUser(
  userId: string,
  purpose: EmailAuthCodePurpose = LOGIN_TWO_FACTOR_PURPOSE
): Promise<RequestTwoFactorEmailCodeResult> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return { sent: false };
  }

  const now = new Date();
  const resendLimit = await getResendLimit(user.id, purpose, now);

  if (resendLimit.limited) {
    return {
      sent: false,
      retryAfterSeconds: resendLimit.retryAfterSeconds,
    };
  }

  const code = generateSixDigitEmailCode();
  const codeHash = hashEmailAuthCode({
    userId: user.id,
    purpose,
    code,
  });
  const expiresAt = addMinutes(now, CODE_EXPIRES_IN_MINUTES);

  await prisma.emailAuthCode.updateMany({
    where: {
      userId: user.id,
      purpose,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  });

  const createdCode = await prisma.emailAuthCode.create({
    data: {
      userId: user.id,
      purpose,
      codeHash,
      expiresAt,
    },
    select: {
      id: true,
    },
  });

  try {
    await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name,
      code,
      expiresInMinutes: CODE_EXPIRES_IN_MINUTES,
    });
  } catch (error) {
    await prisma.emailAuthCode.delete({
      where: {
        id: createdCode.id,
      },
    });

    throw error;
  }

  return { sent: true };
}

export async function verifyTwoFactorEmailCodeForUser({
  userId,
  code,
  purpose = LOGIN_TWO_FACTOR_PURPOSE,
}: {
  userId: string;
  code: string;
  purpose?: EmailAuthCodePurpose;
}): Promise<VerifyTwoFactorEmailCodeResult> {
  const normalizedCode = code.trim();
  const now = new Date();
  const authCode = await prisma.emailAuthCode.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
    },
    select: {
      id: true,
      codeHash: true,
      attempts: true,
      expiresAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!authCode) {
    return {
      valid: false,
      reason: "invalid",
    };
  }

  if (authCode.expiresAt <= now) {
    await prisma.emailAuthCode.update({
      where: {
        id: authCode.id,
      },
      data: {
        usedAt: now,
      },
    });

    return {
      valid: false,
      reason: "expired",
    };
  }

  const nextAttempts = authCode.attempts + 1;

  if (nextAttempts > MAX_VERIFICATION_ATTEMPTS) {
    await prisma.emailAuthCode.update({
      where: {
        id: authCode.id,
      },
      data: {
        attempts: nextAttempts,
        usedAt: now,
      },
    });

    return {
      valid: false,
      reason: "too_many_attempts",
    };
  }

  const receivedHash = hashEmailAuthCode({
    userId,
    purpose,
    code: normalizedCode,
  });
  const isValid =
    isValidNumericCode(normalizedCode) && safeCompareHash(authCode.codeHash, receivedHash);

  await prisma.emailAuthCode.update({
    where: {
      id: authCode.id,
    },
    data: {
      attempts: nextAttempts,
      usedAt: isValid ? now : null,
    },
  });

  if (!isValid) {
    return {
      valid: false,
      reason: "invalid",
    };
  }

  return {
    valid: true,
  };
}
