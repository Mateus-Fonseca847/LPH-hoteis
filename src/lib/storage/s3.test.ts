import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStorageProvider, S3StorageProvider } from "@/lib/storage";

const originalNodeEnv = process.env.NODE_ENV;

describe("storage providers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.S3_ENDPOINT = "https://storage.example.test";
    process.env.S3_BUCKET = "uploads";
    process.env.S3_ACCESS_KEY_ID = "access-key";
    process.env.S3_SECRET_ACCESS_KEY = "secret-key";
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.test/assets";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.STORAGE_PROVIDER;
  });

  it("envia objeto para storage S3-compatible com URL publica sem segredo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const stored = await new S3StorageProvider().putObject({
      key: "hotels/hotel_1/foto.png",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      size: 3,
    });

    expect(stored).toEqual({
      key: "hotels/hotel_1/foto.png",
      url: "https://cdn.example.test/assets/hotels/hotel_1/foto.png",
      contentType: "image/png",
      size: 3,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://storage.example.test/uploads/hotels/hotel_1/foto.png"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          authorization: expect.stringContaining("Credential=access-key/"),
          "content-type": "image/png",
          "x-amz-content-sha256": expect.any(String),
        }),
      })
    );
    expect(JSON.stringify(stored)).not.toContain("secret-key");
  });

  it("remove objeto remoto apenas quando URL pertence ao public base configurado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new S3StorageProvider();

    await expect(
      provider.deleteObject({ url: "https://cdn.example.test/assets/hotels/hotel_1/foto.png" })
    ).resolves.toEqual({ status: "removed" });
    await expect(
      provider.deleteObject({ url: "https://outro.example.test/assets/hotels/hotel_1/foto.png" })
    ).resolves.toEqual({ status: "skipped" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bloqueia local storage em producao", () => {
    process.env.NODE_ENV = "production";

    expect(() => createStorageProvider("local")).toThrow("apenas em desenvolvimento");
  });
});
