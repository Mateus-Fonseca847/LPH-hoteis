import { describe, expect, it } from "vitest";

import { buildImageRemotePatterns, getRemotePatternFromUrl } from "./next.config";

describe("next image remote patterns", () => {
  it("permite Unsplash, Vercel Blob e storages configurados", () => {
    const patterns = buildImageRemotePatterns({
      S3_PUBLIC_BASE_URL: "https://cdn.example.test/assets",
      NEXT_PUBLIC_STORAGE_BASE_URL: "https://media.example.test/uploads",
    });

    expect(patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "https",
          hostname: "images.unsplash.com",
        }),
        expect.objectContaining({
          protocol: "https",
          hostname: "**.public.blob.vercel-storage.com",
        }),
        expect.objectContaining({
          protocol: "https",
          hostname: "blob.vercel-storage.com",
        }),
        expect.objectContaining({
          protocol: "https",
          hostname: "cdn.example.test",
          pathname: "/assets/**",
        }),
        expect.objectContaining({
          protocol: "https",
          hostname: "media.example.test",
          pathname: "/uploads/**",
        }),
      ])
    );
  });

  it("ignora variaveis de storage invalidas", () => {
    expect(getRemotePatternFromUrl("ftp://cdn.example.test/assets")).toBeNull();
    expect(getRemotePatternFromUrl("not a url")).toBeNull();
  });
});
