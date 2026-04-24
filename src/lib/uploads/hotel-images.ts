import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const allowedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

function getFileExtension(fileName: string) {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

function assertMagicNumber(buffer: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  if (mimeType === "image/webp") {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  return false;
}

export async function validateHotelImageFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error("Selecione uma imagem válida.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("A imagem excede o limite de 5 MB.");
  }

  const mimeType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  if (!allowedExtensions.has(extension)) {
    throw new Error("Extensão inválida. Use JPG, PNG ou WEBP.");
  }

  const expectedExtension = allowedMimeTypes.get(mimeType);

  if (!expectedExtension || (extension !== expectedExtension && !(mimeType === "image/jpeg" && extension === "jpeg"))) {
    throw new Error("MIME type e extensão não correspondem.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  if (!assertMagicNumber(buffer, mimeType)) {
    throw new Error("O conteúdo do arquivo não corresponde a uma imagem válida.");
  }

  return {
    buffer,
    mimeType,
    extension: mimeType === "image/jpeg" ? "jpg" : expectedExtension,
  };
}

export async function storeHotelImageFile(hotelId: string, file: File) {
  const { buffer, mimeType, extension } = await validateHotelImageFile(file);
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const relativeDir = path.posix.join("uploads", "hotels", hotelId);
  const relativePath = path.posix.join(relativeDir, fileName);
  const outputDir = path.join(process.cwd(), "public", "uploads", "hotels", hotelId);
  const outputPath = path.join(outputDir, fileName);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, buffer);

  return {
    url: `/${relativePath}`,
    storageKey: relativePath,
    contentType: mimeType,
    size: file.size,
    originalName: file.name,
  };
}

export async function deleteStoredHotelImageFile(imageUrl: string) {
  if (!imageUrl.startsWith("/uploads/hotels/")) {
    return;
  }

  const relativePath = imageUrl.replace(/^\//, "").split("/").join(path.sep);
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  await rm(absolutePath, { force: true });
}
