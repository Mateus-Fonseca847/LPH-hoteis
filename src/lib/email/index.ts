import { Resend } from "resend";

type EmailProvider = "development" | "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SendTwoFactorCodeEmailInput = {
  to: string;
  name?: string | null;
  code: string;
  expiresInMinutes: number;
};

const DEVELOPMENT_PROVIDER = "development";
const RESEND_PROVIDER = "resend";
const TWO_FACTOR_SEND_FAILURE_MESSAGE =
  "Não foi possível enviar o código de verificação. Tente novamente em alguns instantes.";

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailSendError extends Error {
  constructor(message = "Não foi possível enviar o e-mail.") {
    super(message);
    this.name = "EmailSendError";
  }
}

function getConfiguredProvider() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!provider) {
    return process.env.RESEND_API_KEY?.trim() ? RESEND_PROVIDER : DEVELOPMENT_PROVIDER;
  }

  if (provider !== DEVELOPMENT_PROVIDER && provider !== RESEND_PROVIDER) {
    throw new Error("EMAIL_PROVIDER inválido.");
  }

  if (provider === DEVELOPMENT_PROVIDER && process.env.RESEND_API_KEY?.trim()) {
    return RESEND_PROVIDER;
  }

  if (process.env.NODE_ENV === "production" && provider === DEVELOPMENT_PROVIDER) {
    throw new Error("EMAIL_PROVIDER=development não pode ser usado em produção.");
  }

  return provider as EmailProvider;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    const message =
      name === "RESEND_API_KEY"
        ? "RESEND_API_KEY não configurada"
        : name === "EMAIL_FROM"
          ? "EMAIL_FROM não configurado"
          : `${name} não configurado`;

    console.error(`[email/config] ${message}.`);
    throw new EmailConfigurationError(message);
  }

  return value;
}

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visibleLocal = localPart.slice(0, 2);

  return `${visibleLocal || "**"}***@${domain || "dominio"}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendDevelopmentEmail(input: SendEmailInput, metadata?: { code?: string }) {
  const payload: Record<string, string> = {
    to: maskEmail(input.to),
    subject: input.subject,
  };

  if (metadata?.code && !process.env.RESEND_API_KEY?.trim()) {
    payload.code = metadata.code;
  }

  console.info("[email/development] E-mail preparado.", payload);
}

async function sendResendEmail(input: SendEmailInput) {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const { data, error } = await resend.emails.send({
    from: getRequiredEnv("EMAIL_FROM"),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (error) {
    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined;

    console.error("[email/resend] Falha ao enviar e-mail.", {
      name: error.name,
      message: error.message,
      statusCode,
    });

    throw new EmailSendError();
  }

  if (!data?.id) {
    console.error("[email/resend] Resend não retornou id do e-mail.");
    throw new EmailSendError();
  }
}

export async function sendEmail(input: SendEmailInput, metadata?: { code?: string }) {
  const provider = getConfiguredProvider();

  if (provider === DEVELOPMENT_PROVIDER) {
    await sendDevelopmentEmail(input, metadata);
    return;
  }

  await sendResendEmail(input);
}

export async function sendTwoFactorCodeEmail(input: SendTwoFactorCodeEmailInput) {
  const displayName = input.name?.trim() || "usuário";
  const safeDisplayName = escapeHtml(displayName);
  const subject = "Código de verificação LPH";
  const text = [
    `Olá, ${displayName}.`,
    "",
    `Seu código de verificação LPH é: ${input.code}`,
    `Ele expira em ${input.expiresInMinutes} minutos.`,
    "",
    "Se você não solicitou este código, ignore este e-mail.",
  ].join("\n");
  const html = `
    <p>Olá, ${safeDisplayName}.</p>
    <p>Seu código de verificação LPH é:</p>
    <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${escapeHtml(input.code)}</p>
    <p>Ele expira em ${input.expiresInMinutes} minutos.</p>
    <p>Se você não solicitou este código, ignore este e-mail.</p>
  `;

  await sendEmail(
    {
      to: input.to,
      subject,
      text,
      html,
    },
    { code: input.code }
  ).catch((error) => {
    if (error instanceof EmailConfigurationError || error instanceof EmailSendError) {
      throw new EmailSendError(TWO_FACTOR_SEND_FAILURE_MESSAGE);
    }

    throw error;
  });
}

export const sendTransactionalEmail = sendEmail;
export const sendTwoFactorEmailCode = sendTwoFactorCodeEmail;
