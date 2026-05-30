import { afterEach, describe, expect, it } from "vitest";

import { LocalStorageProvider, setStorageProviderForTesting } from "@/lib/storage";
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
    delete process.env.UPLOAD_MAX_FILE_NAME_LENGTH;
    delete process.env.UPLOAD_STORAGE_PROVIDER;
    delete process.env.STORAGE_PROVIDER;
    setStorageProviderForTesting(null);
  });

  it("aceita imagem PNG valida e normaliza o nome base", async () => {
    await expect(
      validateHotelImageFile(makeFile({ name: "Hotel Luxo.png" }))
    ).resolves.toMatchObject({
      mimeType: "image/png",
      extension: "png",
      sanitizedBaseName: "hotel-luxo",
    });
  });

  it("rejeita extensao suspeita intermediaria", async () => {
    await expect(validateHotelImageFile(makeFile({ name: "hotel.php.png" }))).rejects.toThrow(
      "extensoes suspeitas"
    );
  });

  it("rejeita MIME type diferente da extensao", async () => {
    await expect(
      validateHotelImageFile(makeFile({ name: "hotel.jpg", type: "image/png" }))
    ).rejects.toThrow("tipo do arquivo");
  });

  it("rejeita conteudo que nao corresponde a imagem", async () => {
    await expect(
      validateHotelImageFile(makeFile({ bytes: new Uint8Array([1, 2, 3, 4, 5]) }))
    ).rejects.toThrow("imagem valida");
  });

  it("bloqueia executaveis mesmo com conteudo enviado", async () => {
    await expect(
      validateHotelImageFile(makeFile({ name: "instalador.exe", type: "application/x-msdownload" }))
    ).rejects.toThrow("Formato nao permitido");
  });

  it("bloqueia scripts disfarcados com extensao intermediaria", async () => {
    await expect(validateHotelImageFile(makeFile({ name: "hotel.js.png" }))).rejects.toThrow(
      "extensoes suspeitas"
    );
  });

  it("bloqueia arquivo desconhecido sem extensao", async () => {
    await expect(validateHotelImageFile(makeFile({ name: "arquivo" }))).rejects.toThrow(
      "extensao valida"
    );
  });

  it("respeita limite configurado por UPLOAD_MAX_IMAGE_SIZE_BYTES", async () => {
    process.env.UPLOAD_MAX_IMAGE_SIZE_BYTES = "4";

    await expect(validateHotelImageFile(makeFile())).rejects.toThrow("excede o limite");
  });

  it("respeita limite configurado por UPLOAD_MAX_FILE_NAME_LENGTH", async () => {
    process.env.UPLOAD_MAX_FILE_NAME_LENGTH = "12";

    await expect(validateHotelImageFile(makeFile({ name: "nome-muito-longo.png" }))).rejects.toThrow(
      "ate 12 caracteres"
    );
  });

  it("grava imagem usando a camada de storage configurada", async () => {
    setStorageProviderForTesting({
      putObject: async (input) => ({
        key: input.key,
        url: `/uploads/${input.key}`,
        contentType: input.contentType,
        size: input.size,
      }),
      deleteObject: async () => ({ status: "skipped" }),
    });

    await expect(storeHotelImageFile("hotel_12345", makeFile())).resolves.toMatchObject({
      url: expect.stringMatching(/^\/uploads\/hotels\/hotel_12345\//),
      storageKey: expect.stringMatching(/^hotels\/hotel_12345\//),
      contentType: "image/png",
      size: pngBytes.length,
    });
  });

  it("bloqueia provider remoto ainda nao configurado", async () => {
    process.env.STORAGE_PROVIDER = "s3";

    await expect(storeHotelImageFile("hotel_12345", makeFile())).rejects.toThrow(
      "S3 ainda nao configurado"
    );
  });

  it("bloqueia remocao local fora do diretorio de uploads", async () => {
    setStorageProviderForTesting(new LocalStorageProvider());

    await expect(deleteStoredHotelImageFile("/uploads/hotels/../../package.json")).rejects.toThrow(
      "Chave de storage invalida"
    );
  });
});
