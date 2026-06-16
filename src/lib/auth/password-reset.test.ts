import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/auth/password-reset";
import { verifyPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailAuthCode: {
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const user = {
  id: "user_123456",
  name: "Maria",
  email: "maria@example.com",
  isActive: true,
};

function getSentToken() {
  const call = vi.mocked(sendPasswordResetEmail).mock.calls[0]?.[0];
  const resetUrl = call?.resetUrl;

  if (!resetUrl) {
    throw new Error("Reset URL not sent.");
  }

  return new URL(resetUrl).searchParams.get("token") ?? "";
}

describe("password reset flow", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.update).mockReset();
    vi.mocked(prisma.emailAuthCode.updateMany).mockReset();
    vi.mocked(prisma.emailAuthCode.create).mockReset();
    vi.mocked(prisma.emailAuthCode.delete).mockReset();
    vi.mocked(prisma.emailAuthCode.findUnique).mockReset();
    vi.mocked(prisma.emailAuthCode.update).mockReset();
    vi.mocked(prisma.emailAuthCode.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.$transaction)
      .mockReset()
      .mockImplementation(async (callback) =>
        callback({
          user: {
            update: prisma.user.update,
          },
          emailAuthCode: {
            updateMany: prisma.emailAuthCode.updateMany,
          },
        })
      );
    vi.mocked(sendPasswordResetEmail).mockReset().mockResolvedValue(undefined);
  });

  it("cria token hasheado para e-mail existente e envia e-mail", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user);
    vi.mocked(prisma.emailAuthCode.create).mockResolvedValue({ id: "reset_token_123" });

    const result = await requestPasswordReset("Maria@Example.com", "https://lph.test");
    const createdData = vi.mocked(prisma.emailAuthCode.create).mock.calls[0]?.[0].data;
    const token = getSentToken();
    const [, secret] = token.split(".");

    expect(result.message).toBe(PASSWORD_RESET_NEUTRAL_MESSAGE);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "maria@example.com" } })
    );
    expect(prisma.emailAuthCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: user.id,
          purpose: "password_reset",
          usedAt: null,
        }),
      })
    );
    expect(createdData).toMatchObject({
      userId: user.id,
      purpose: "password_reset",
    });
    expect(createdData.codeHash).not.toBe(secret);
    expect(createdData.codeHash).not.toContain(secret);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        resetUrl: expect.stringContaining("/redefinir-senha?token="),
      })
    );
  });

  it("retorna mensagem neutra para e-mail inexistente", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await requestPasswordReset("ninguem@example.com", "https://lph.test");

    expect(result.message).toBe(PASSWORD_RESET_NEUTRAL_MESSAGE);
    expect(prisma.emailAuthCode.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("bloqueia token expirado", async () => {
    vi.mocked(prisma.emailAuthCode.findUnique).mockResolvedValue({
      id: "reset_token_123",
      userId: user.id,
      codeHash: "abc",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() - 1_000),
      usedAt: null,
      user,
    });

    await expect(resetPasswordWithToken("reset_token_123.secret", "novaSenha1")).rejects.toThrow(
      "Link de redefinição inválido ou expirado."
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("bloqueia token ja usado", async () => {
    vi.mocked(prisma.emailAuthCode.findUnique).mockResolvedValue({
      id: "reset_token_123",
      userId: user.id,
      codeHash: "abc",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 1_000_000),
      usedAt: new Date(),
      user,
    });

    await expect(resetPasswordWithToken("reset_token_123.secret", "novaSenha1")).rejects.toThrow(
      "Link de redefinição inválido ou expirado."
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("atualiza passwordHash e invalida token valido", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user);
    vi.mocked(prisma.emailAuthCode.create).mockResolvedValue({ id: "reset_token_123" });
    await requestPasswordReset(user.email, "https://lph.test");
    const createdData = vi.mocked(prisma.emailAuthCode.create).mock.calls[0][0].data;
    const token = getSentToken();
    vi.mocked(prisma.emailAuthCode.findUnique).mockResolvedValue({
      id: "reset_token_123",
      userId: user.id,
      codeHash: createdData.codeHash,
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 1_000_000),
      usedAt: null,
      user,
    });
    vi.mocked(prisma.user.update).mockResolvedValue({ id: user.id });

    const result = await resetPasswordWithToken(token, "novaSenha1");
    const passwordHash = vi.mocked(prisma.user.update).mock.calls[0]?.[0].data.passwordHash;

    expect(result.message).toBe("Senha redefinida com sucesso. Faça login para continuar.");
    expect(passwordHash).not.toBe("novaSenha1");
    await expect(verifyPassword("novaSenha1", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("senhaAntiga1", passwordHash)).resolves.toBe(false);
    expect(prisma.emailAuthCode.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "reset_token_123", usedAt: null },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    );
  });

  it("nao altera configuracao de 2FA ao redefinir senha", async () => {
    vi.mocked(prisma.emailAuthCode.findUnique).mockResolvedValue({
      id: "reset_token_123",
      userId: user.id,
      codeHash: "bad",
      purpose: "login_2fa",
      expiresAt: new Date(Date.now() + 1_000_000),
      usedAt: null,
      user,
    });

    await expect(resetPasswordWithToken("reset_token_123.secret", "novaSenha1")).rejects.toThrow(
      "Link de redefinição inválido ou expirado."
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
