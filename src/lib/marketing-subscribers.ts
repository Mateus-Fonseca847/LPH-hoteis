import { Prisma } from "@prisma/client";

import { ConflictError, ValidationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOOTER_SOURCE = "home_footer";

export function normalizeSubscriberEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateSubscriberEmail(email: string) {
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError("Informe um e-mail válido.");
  }
}

export async function createMarketingSubscriber(input: {
  email: unknown;
  consentAccepted: unknown;
}) {
  const email = normalizeSubscriberEmail(input.email);

  validateSubscriberEmail(email);

  if (input.consentAccepted !== true) {
    throw new ValidationError("É necessário aceitar o recebimento de comunicações promocionais.");
  }

  const existingSubscriber = await prisma.marketingSubscriber.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingSubscriber) {
    throw new ConflictError("Este e-mail já está cadastrado para receber promoções.");
  }

  try {
    return await prisma.marketingSubscriber.create({
      data: {
        email,
        source: FOOTER_SOURCE,
        consentAccepted: true,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Este e-mail já está cadastrado para receber promoções.");
    }

    throw error;
  }
}
