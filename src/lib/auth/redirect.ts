export function normalizeRedirectTarget(redirectTo?: string | null) {
  if (!redirectTo) {
    return "/";
  }

  const normalized = redirectTo.trim();

  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/";
  }

  return normalized;
}
