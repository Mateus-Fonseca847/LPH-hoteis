import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "lph_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
export const PENDING_TWO_FACTOR_DURATION_SECONDS = 60 * 10;

const SESSION_ISSUER = "lph-hoteis";
const SESSION_AUDIENCE = "lph-web";

export type AuthSessionPayload = {
  sub: string;
  globalRole: string;
  twoFactorVerified: boolean;
  twoFactorSetupRequired: boolean;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET não configurado.");
  }

  return new TextEncoder().encode(secret);
}

function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  };
}

async function createSessionToken(payload: AuthSessionPayload, maxAge: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getAuthSecret());
}

export async function setAuthSessionCookie(payload: AuthSessionPayload) {
  const token = await createSessionToken(payload, SESSION_DURATION_SECONDS);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(SESSION_DURATION_SECONDS));
}

export async function setPendingTwoFactorSessionCookie(
  payload: Omit<AuthSessionPayload, "twoFactorVerified" | "twoFactorSetupRequired"> & {
    twoFactorSetupRequired: boolean;
  }
) {
  const token = await createSessionToken(
    {
      ...payload,
      twoFactorVerified: false,
      twoFactorSetupRequired: payload.twoFactorSetupRequired,
    },
    PENDING_TWO_FACTOR_DURATION_SECONDS
  );

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(PENDING_TWO_FACTOR_DURATION_SECONDS)
  );
}

export async function clearAuthSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    return payload as unknown as AuthSessionPayload;
  } catch (error) {
    console.warn("[auth/session] Invalid session cookie discarded.", error);

    try {
      await clearAuthSessionCookie();
    } catch (clearError) {
      console.warn("[auth/session] Unable to clear invalid cookie in current context.", clearError);
    }

    return null;
  }
}
