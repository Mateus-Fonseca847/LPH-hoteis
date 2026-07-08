import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const immutableAssetHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

export function getRemotePatternFromUrl(value: string | undefined) {
  const publicBaseUrl = value?.trim();

  if (!publicBaseUrl) {
    return null;
  }

  try {
    const url = new URL(publicBaseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: `${url.pathname.replace(/\/+$/, "") || ""}/**`,
    };
  } catch {
    return null;
  }
}

function getUniqueRemotePatterns(
  patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>
) {
  const seen = new Set<string>();

  return patterns.filter((pattern) => {
    const key = [
      pattern.protocol,
      pattern.hostname,
      pattern.port ?? "",
      pattern.pathname ?? "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildImageRemotePatterns(env = process.env) {
  const storageRemotePattern = getRemotePatternFromUrl(env.S3_PUBLIC_BASE_URL);
  const nextPublicStorageRemotePattern = getRemotePatternFromUrl(env.NEXT_PUBLIC_STORAGE_BASE_URL);

  return getUniqueRemotePatterns([
    {
      protocol: "https",
      hostname: "images.unsplash.com",
    },
    {
      protocol: "https",
      hostname: "**.public.blob.vercel-storage.com",
    },
    {
      protocol: "https",
      hostname: "blob.vercel-storage.com",
    },
    ...(storageRemotePattern ? [storageRemotePattern] : []),
    ...(nextPublicStorageRemotePattern ? [nextPublicStorageRemotePattern] : []),
  ]);
}

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 390, 430, 640, 768, 1024, 1280, 1440, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: buildImageRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/uploads/:path*",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/:path*",
        headers: immutableAssetHeaders,
      },
    ];
  },
};

export default nextConfig;
