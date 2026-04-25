import { createHash } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 20;
const MAX_ATTEMPTS_PER_EMAIL = 8;
const MAX_ATTEMPTS_PER_COMBINATION = 6;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

type AttemptBucket = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
};

type LoginRateLimitInput = {
  email: string;
  ip: string;
};

type SecurityEventPayload = {
  type: "login_rate_limit_blocked" | "login_failed_threshold";
  ip: string;
  email: string;
  scope: "ip" | "email" | "combination";
};

const buckets = new Map<string, AttemptBucket>();

function getBucketKey(scope: string, value: string) {
  return `${scope}:${value}`;
}

function getNow() {
  return Date.now();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function maskIp(ip: string) {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }

  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 4).join(":")}:****`;
  }

  return "unknown";
}

function normalizeBucket(bucket: AttemptBucket, now: number) {
  if (bucket.blockedUntil && bucket.blockedUntil <= now) {
    bucket.blockedUntil = null;
    bucket.count = 0;
    bucket.firstAttemptAt = now;
  }

  if (now - bucket.firstAttemptAt > WINDOW_MS) {
    bucket.count = 0;
    bucket.firstAttemptAt = now;
  }
}

function getOrCreateBucket(key: string, now: number) {
  const current = buckets.get(key) ?? {
    count: 0,
    firstAttemptAt: now,
    blockedUntil: null,
  };

  normalizeBucket(current, now);
  buckets.set(key, current);
  return current;
}

function emitSecurityEvent(payload: SecurityEventPayload) {
  console.warn("[auth-security]", {
    type: payload.type,
    scope: payload.scope,
    ip: maskIp(payload.ip),
    emailHash: hashValue(payload.email),
    at: new Date().toISOString(),
  });
}

function getIdentifiers(input: LoginRateLimitInput) {
  return {
    ipKey: getBucketKey("ip", input.ip),
    emailKey: getBucketKey("email", input.email),
    combinationKey: getBucketKey("combination", `${input.ip}:${input.email}`),
  };
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

export function isLoginRateLimited(input: LoginRateLimitInput) {
  const now = getNow();
  const { ipKey, emailKey, combinationKey } = getIdentifiers(input);
  const entries = [
    { scope: "ip" as const, bucket: getOrCreateBucket(ipKey, now) },
    { scope: "email" as const, bucket: getOrCreateBucket(emailKey, now) },
    { scope: "combination" as const, bucket: getOrCreateBucket(combinationKey, now) },
  ];

  const blocked = entries.find((entry) => entry.bucket.blockedUntil && entry.bucket.blockedUntil > now);

  if (blocked) {
    emitSecurityEvent({
      type: "login_rate_limit_blocked",
      ip: input.ip,
      email: input.email,
      scope: blocked.scope,
    });

    return {
      limited: true as const,
      retryAfterSeconds: Math.ceil(((blocked.bucket.blockedUntil ?? now) - now) / 1000),
    };
  }

  return {
    limited: false as const,
    retryAfterSeconds: 0,
  };
}

export function recordFailedLoginAttempt(input: LoginRateLimitInput) {
  const now = getNow();
  const { ipKey, emailKey, combinationKey } = getIdentifiers(input);
  const scopes = [
    { scope: "ip" as const, key: ipKey, maxAttempts: MAX_ATTEMPTS_PER_IP },
    { scope: "email" as const, key: emailKey, maxAttempts: MAX_ATTEMPTS_PER_EMAIL },
    { scope: "combination" as const, key: combinationKey, maxAttempts: MAX_ATTEMPTS_PER_COMBINATION },
  ];

  scopes.forEach(({ scope, key, maxAttempts }) => {
    const bucket = getOrCreateBucket(key, now);
    bucket.count += 1;

    if (bucket.count >= maxAttempts) {
      bucket.blockedUntil = now + BLOCK_DURATION_MS;
      emitSecurityEvent({
        type: "login_failed_threshold",
        ip: input.ip,
        email: input.email,
        scope,
      });
    }

    buckets.set(key, bucket);
  });
}

export function clearFailedLoginAttempts(input: LoginRateLimitInput) {
  const { ipKey, emailKey, combinationKey } = getIdentifiers(input);
  buckets.delete(ipKey);
  buckets.delete(emailKey);
  buckets.delete(combinationKey);
}
