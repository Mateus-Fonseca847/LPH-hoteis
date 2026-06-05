import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/login/route";
import { requestTwoFactorEmailCodeForUser } from "@/lib/auth/email-two-factor";
import {
  clearAuthSessionCookie,
  setAuthSessionCookie,
  setPendingTwoFactorSessionCookie,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/user";
import { verifyPassword } from "@/lib/auth/password";

vi.mock("@/lib/auth", () => ({
  isAdminUser: (role: string) => role === "hotel_admin" || role === "super_admin",
}));

vi.mock("@/lib/auth/email-two-factor", () => ({
  requestTwoFactorEmailCodeForUser: vi.fn(),
}));

vi.mock("@/lib/auth/login-rate-limit", () => ({
  clearFailedLoginAttempts: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  isLoginRateLimited: vi.fn(() => ({ limited: false })),
  recordFailedLoginAttempt: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  clearAuthSessionCookie: vi.fn(),
  setAuthSessionCookie: vi.fn(),
  setPendingTwoFactorSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  findUserByEmail: vi.fn(),
}));

function createRequest() {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "senha-segura",
    }),
  });
}

function mockUser(
  globalRole: "super_admin" | "hotel_admin" | "user",
  emailTwoFactorEnabled = false
) {
  vi.mocked(findUserByEmail).mockResolvedValue({
    id: `${globalRole}-1`,
    name: "Admin LPH",
    email: "admin@example.com",
    passwordHash: "hashed-password",
    globalRole,
    isActive: true,
    emailTwoFactorEnabled,
  } as never);
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.mocked(findUserByEmail).mockReset();
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(clearAuthSessionCookie).mockReset();
    vi.mocked(setAuthSessionCookie).mockReset();
    vi.mocked(setPendingTwoFactorSessionCookie).mockReset();
    vi.mocked(requestTwoFactorEmailCodeForUser).mockReset();

    vi.mocked(verifyPassword).mockResolvedValue(true);
  });

  it("permite hotel_admin sem 2FA logar com e-mail e senha", async () => {
    mockUser("hotel_admin", false);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresTwoFactor).toBeUndefined();
    expect(body.error).toBeUndefined();
    expect(setAuthSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "hotel_admin-1",
        globalRole: "hotel_admin",
        twoFactorVerified: true,
        twoFactorSetupRequired: false,
      })
    );
    expect(requestTwoFactorEmailCodeForUser).not.toHaveBeenCalled();
    expect(setPendingTwoFactorSessionCookie).not.toHaveBeenCalled();
  });

  it("permite super_admin sem 2FA logar com e-mail e senha", async () => {
    mockUser("super_admin", false);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresTwoFactor).toBeUndefined();
    expect(body.error).toBeUndefined();
    expect(setAuthSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "super_admin-1",
        globalRole: "super_admin",
        twoFactorVerified: true,
        twoFactorSetupRequired: false,
      })
    );
    expect(requestTwoFactorEmailCodeForUser).not.toHaveBeenCalled();
  });

  it("mantém o fluxo de código para admin com 2FA ativado", async () => {
    mockUser("hotel_admin", true);
    vi.mocked(requestTwoFactorEmailCodeForUser).mockResolvedValue({ sent: true });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresTwoFactor).toBe(true);
    expect(requestTwoFactorEmailCodeForUser).toHaveBeenCalledWith("hotel_admin-1");
    expect(setPendingTwoFactorSessionCookie).toHaveBeenCalledWith({
      sub: "hotel_admin-1",
      globalRole: "hotel_admin",
      twoFactorSetupRequired: false,
    });
    expect(setAuthSessionCookie).not.toHaveBeenCalled();
  });
});
