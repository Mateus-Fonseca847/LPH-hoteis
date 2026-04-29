type EmailProvider = "development" | "resend";

type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SendTwoFactorEmailCodeInput = {
  to: string;
  name?: string | null;
  code: string;
  expiresInMinutes: number;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

const DEVELOPMENT_PROVIDER = "development";
const RESEND_PROVIDER = "resend";

function getEmailProvider() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_PROVIDER deve ser configurado em producao.");
    }

    return DEVELOPMENT_PROVIDER satisfies EmailProvider;
  }

  if (provider !== DEVELOPMENT_PROVIDER && provider !== RESEND_PROVIDER) {
    throw new Error("EMAIL_PROVIDER invalido.");
  }

  if (process.env.NODE_ENV === "production" && provider === DEVELOPMENT_PROVIDER) {
    throw new Error("EMAIL_PROVIDER=development nao pode ser usado em producao.");
  }

  return provider as EmailProvider;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} deve ser configurado.`);
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

async function sendDevelopmentEmail(input: SendTransactionalEmailInput) {
  console.info("[email/development] E-mail transacional preparado.", {
    to: maskEmail(input.to),
    subject: input.subject,
  });
}

async function sendResendEmail(input: SendTransactionalEmailInput) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("EMAIL_FROM");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ResendEmailResponse | null;

    console.error("[email/resend] Falha ao enviar e-mail transacional.", {
      status: response.status,
      error: payload?.message || payload?.name || "Erro nao detalhado.",
    });

    throw new Error("Nao foi possivel enviar o e-mail transacional.");
  }
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const provider = getEmailProvider();

  if (provider === DEVELOPMENT_PROVIDER) {
    await sendDevelopmentEmail(input);
    return;
  }

  await sendResendEmail(input);
}

export async function sendTwoFactorEmailCode(input: SendTwoFactorEmailCodeInput) {
  const displayName = input.name?.trim() || "usuario";
  const safeDisplayName = escapeHtml(displayName);
  const subject = "Codigo de verificacao LPH";
  const text = [
    `Ola, ${displayName}.`,
    "",
    `Seu codigo de verificacao LPH e: ${input.code}`,
    `Ele expira em ${input.expiresInMinutes} minutos.`,
    "",
    "Se voce nao solicitou este codigo, ignore este e-mail.",
  ].join("\n");
  const html = `
    <p>Ola, ${safeDisplayName}.</p>
    <p>Seu codigo de verificacao LPH e:</p>
    <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${escapeHtml(input.code)}</p>
    <p>Ele expira em ${input.expiresInMinutes} minutos.</p>
    <p>Se voce nao solicitou este codigo, ignore este e-mail.</p>
  `;

  await sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}
