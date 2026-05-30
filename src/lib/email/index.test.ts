import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail, sendTwoFactorCodeEmail } from "@/lib/email";

const resendMock = vi.hoisted(() => ({
  send: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function Resend(apiKey: string) {
    resendMock.constructor(apiKey);

    return {
      emails: {
        send: resendMock.send,
      },
    };
  }),
}));

describe("email provider safety", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.unstubAllEnvs();
    resendMock.send.mockReset();
    resendMock.constructor.mockReset();
    consoleInfo.mockClear();
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("usa provider de desenvolvimento sem chamar Resend nem credenciais reais", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "development");
    vi.stubEnv("NODE_ENV", "test");

    await sendEmail(
      {
        to: "maria@example.test",
        subject: "Teste LPH",
        text: "Mensagem de teste",
      },
      { code: "123456" }
    );

    expect(resendMock.constructor).not.toHaveBeenCalled();
    expect(resendMock.send).not.toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalledWith(
      "[email/development] E-mail preparado.",
      expect.objectContaining({
        to: "ma***@example.test",
        subject: "Teste LPH",
        code: "123456",
      })
    );
  });

  it("envia 2FA via Resend usando mock seguro", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test_resend_key");
    vi.stubEnv("EMAIL_FROM", "LPH Hotéis <no-reply@example.test>");
    resendMock.send.mockResolvedValue({
      data: {
        id: "email-1",
      },
      error: null,
    });

    await sendTwoFactorCodeEmail({
      to: "admin@example.test",
      name: "Admin LPH",
      code: "654321",
      expiresInMinutes: 10,
    });

    expect(resendMock.constructor).toHaveBeenCalledWith("test_resend_key");
    expect(resendMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "LPH Hotéis <no-reply@example.test>",
        to: "admin@example.test",
        subject: "Código de verificação LPH",
        text: expect.stringContaining("654321"),
        html: expect.stringContaining("654321"),
      })
    );
  });

  it("converte falha do Resend em mensagem segura para 2FA", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "test_resend_key");
    vi.stubEnv("EMAIL_FROM", "LPH Hotéis <no-reply@example.test>");
    resendMock.send.mockResolvedValue({
      data: null,
      error: {
        name: "ResendError",
        message: "upstream failure",
        statusCode: 500,
      },
    });

    await expect(
      sendTwoFactorCodeEmail({
        to: "admin@example.test",
        code: "123456",
        expiresInMinutes: 10,
      })
    ).rejects.toThrow(
      "Não foi possível enviar o código de verificação. Tente novamente em alguns instantes."
    );
  });
});
