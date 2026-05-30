import { afterEach, describe, expect, it } from "vitest";

import {
  deleteStoredHotelImageFile,
  storeHotelImageFile,
  validateHotelImageFile,
} from "@/lib/uploads/hotel-images";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function makeFile({
  name = "hotel.png",
  type = "image/png",
  bytes = pngBytes,
}: {
  name?: string;
  type?: string;
  bytes?: Uint8Array;
} = {}) {
  return new File([bytes], name, { type });
}

describe("hotel image upload validation", () => {
  afterEach(() => {
    delete process.env.UPLOAD_MAX_IMAGE_SIZE_BYTES;
    delete process.env.UPLOAD_STORAGE_PROVIDER;
  });

  it("aceita imagem PNG válida e normaliza o nome base", async () => {
    await expect(
      validateHotelImageFile(makeFile({ name: "Hotel Luxo.png" }))
    ).resolves.toMatchObject({
      mimeType: "image/png",
      extension: "png",
      sanitizedBaseName: "hotel-luxo",
    });
  });

  it("rejeita extensão suspeita intermediária", async () => {
    await expect(validateHotelImageFile(makeFile({ name: "hotel.php.png" }))).rejects.toThrow(
      "extensões suspeitas"
    );
  });

  it("rejeita MIME type diferente da extensão", async () => {
    await expect(
      validateHotelImageFile(makeFile({ name: "hotel.jpg", type: "image/png" }))
    ).rejects.toThrow("MIME type e extensão");
  });

  it("rejeita conteúdo que não corresponde a imagem", async () => {
    await expect(
      validateHotelImageFile(makeFile({ bytes: new Uint8Array([1, 2, 3, 4, 5]) }))
    ).rejects.toThrow("conteúdo do arquivo");
  });

  it("respeita limite configurado por UPLOAD_MAX_IMAGE_SIZE_BYTES", async () => {
    process.env.UPLOAD_MAX_IMAGE_SIZE_BYTES = "4";

    await expect(validateHotelImageFile(makeFile())).rejects.toThrow("excede o limite");
  });

  it("bloqueia upload quando storage externo ainda não está configurado", async () => {
    process.env.UPLOAD_STORAGE_PROVIDER = "external_url";

    await expect(storeHotelImageFile("hotel_12345", makeFile())).rejects.toThrow(
      "Storage externo ainda não configurado"
    );
  });

  it("bloqueia remoção local fora do diretório de uploads", async () => {
    await expect(deleteStoredHotelImageFile("/uploads/hotels/../../package.json")).rejects.toThrow(
      "Caminho de imagem inválido"
    );
  });
});
