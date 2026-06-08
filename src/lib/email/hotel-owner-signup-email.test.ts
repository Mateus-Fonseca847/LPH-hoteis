import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("resend", () => ({
  Resend: vi.fn(),
}));

describe("hotel owner signup emails", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("EMAIL_PROVIDER", "development");
    vi.stubEnv("RESEND_API_KEY", "");
  });

  it("e-mail de aprovação não contém senha", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { sendHotelOwnerSignupApprovedEmail } = await import("@/lib/email");

    await sendHotelOwnerSignupApprovedEmail({
      to: "maria@hotel.com",
      responsibleName: "Maria Oliveira",
      hotelName: "Hotel Central",
    });

    const loggedPayload = infoSpy.mock.calls[0]?.[1] as Record<string, string> | undefined;
    const output = JSON.stringify(loggedPayload ?? {});

    expect(output).toContain("Acesso aprovado");
    expect(output).not.toContain("senha123");
    expect(output).not.toContain("temporária");

    infoSpy.mockRestore();
  });
});
