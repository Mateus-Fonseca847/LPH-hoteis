import { afterEach, describe, expect, it, vi } from "vitest";
import { del, put } from "@vercel/blob";

import { createStorageProvider, VercelBlobStorageProvider } from "@/lib/storage";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

describe("VercelBlobStorageProvider", () => {
  afterEach(() => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.mocked(put).mockReset();
    vi.mocked(del).mockReset();
  });

  it("é selecionado por STORAGE_PROVIDER=vercel_blob", () => {
    process.env.STORAGE_PROVIDER = "vercel_blob";
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";

    expect(createStorageProvider()).toBeInstanceOf(VercelBlobStorageProvider);
  });

  it("envia imagem pública para Vercel Blob", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/hotels/hotel-1/foto.png",
      downloadUrl: "https://blob.vercel-storage.com/hotels/hotel-1/foto.png?download=1",
      pathname: "hotels/hotel-1/foto.png",
      contentType: "image/png",
      contentDisposition: "inline",
    });

    await expect(
      new VercelBlobStorageProvider().putObject({
        key: "hotels/hotel-1/foto.png",
        body: new Uint8Array([1, 2, 3]),
        contentType: "image/png",
        size: 3,
      })
    ).resolves.toEqual({
      key: "hotels/hotel-1/foto.png",
      url: "https://blob.vercel-storage.com/hotels/hotel-1/foto.png",
      contentType: "image/png",
      size: 3,
    });

    expect(put).toHaveBeenCalledWith(
      "hotels/hotel-1/foto.png",
      expect.any(Blob),
      expect.objectContaining({
        access: "public",
        contentType: "image/png",
        token: "blob-token",
      })
    );
  });

  it("retorna erro claro quando token não está configurado", async () => {
    await expect(
      new VercelBlobStorageProvider().putObject({
        key: "hotels/hotel-1/foto.png",
        body: new Uint8Array([1, 2, 3]),
        contentType: "image/png",
        size: 3,
      })
    ).rejects.toThrow("Storage de imagens não configurado.");
    expect(put).not.toHaveBeenCalled();
  });
});
