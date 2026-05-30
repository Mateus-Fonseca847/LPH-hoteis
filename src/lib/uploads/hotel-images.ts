import { randomUUID } from "node:crypto";
import path from "node:path";

import { getStorageProvider } from "@/lib/storage";

const DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILE_NAME_LENGTH = 180;

const allowedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const suspiciousExtensions = new Set([
  "php",
  "phtml",
  "phar",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "html",
  "htm",
  "svg",
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "scr",
  "msi",
  "sh",
  "bash",
  "ps1",
  "py",
  "rb",
  "jar",
]);

type StoredHotelImage = {
  url: string;
  storageKey: string;
  contentType: string;
  size: number;
};

function getMaxImageSizeBytes() {
  return readPositiveIntegerEnv("UPLOAD_MAX_IMAGE_SIZE_BYTES", DEFAULT_MAX_IMAGE_SIZE_BYTES);
}

function getMaxImageSizeLabel(bytes: number) {
  const megaBytes = bytes / (1024 * 1024);

  return Number.isInteger(megaBytes) ? `${megaBytes} MB` : `${megaBytes.toFixed(1)} MB`;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function getMaxFileNameLength() {
  return readPositiveIntegerEnv("UPLOAD_MAX_FILE_NAME_LENGTH", DEFAULT_MAX_FILE_NAME_LENGTH);
}

function sanitizeStorageSegment(value: string, label: string) {
  const sanitized = value.trim();

  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(sanitized)) {
    throw new Error(`${label} invalido para armazenamento.`);
  }

  return sanitized;
}

function sanitizeFileBaseName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "imagem"
  );
}

function parseFileName(fileName: string) {
  const maxFileNameLength = getMaxFileNameLength();
  const normalizedName = path
    .basename(fileName)
    .replace(/[\u0000-\u001F\u007F]+/g, "")
    .trim();

  if (!normalizedName) {
    throw new Error("O arquivo precisa ter um nome valido.");
  }

  if (normalizedName.length > maxFileNameLength) {
    throw new Error(`O nome do arquivo deve ter ate ${maxFileNameLength} caracteres.`);
  }

  const parts = normalizedName
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error("O arquivo precisa ter uma extensao valida.");
  }

  const baseName = parts[0];
  const extension = parts.at(-1)?.toLowerCase() ?? "";
  const intermediateExtensions = parts.slice(1, -1).map((part) => part.toLowerCase());

  if (!baseName) {
    throw new Error("O arquivo precisa ter um nome valido.");
  }

  if (!extension) {
    throw new Error("O arquivo precisa ter uma extensao valida.");
  }

  if (intermediateExtensions.some((part) => suspiciousExtensions.has(part))) {
    throw new Error("Nome de arquivo invalido. Remova extensoes suspeitas e tente novamente.");
  }

  return {
    extension,
    sanitizedBaseName: sanitizeFileBaseName(baseName),
  };
}

function assertMagicNumber(buffer: Uint8Array, mimeType: string) {
  if (buffer.length < 12) {
    return false;
  }

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
    throw new Error("Selecione uma imagem valida.");
  }

  const maxImageSizeBytes = getMaxImageSizeBytes();

  if (file.size > maxImageSizeBytes) {
    throw new Error(`A imagem excede o limite de ${getMaxImageSizeLabel(maxImageSizeBytes)}.`);
  }

  const mimeType = file.type.toLowerCase();
  const { extension, sanitizedBaseName } = parseFileName(file.name);

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("Formato nao permitido. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
  }

  if (!allowedExtensions.has(extension)) {
    throw new Error("Extensao nao permitida. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
  }

  const expectedExtension = allowedMimeTypes.get(mimeType);

  if (
    !expectedExtension ||
    (extension !== expectedExtension && !(mimeType === "image/jpeg" && extension === "jpeg"))
  ) {
    throw new Error("O tipo do arquivo nao corresponde a extensao informada.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  if (!assertMagicNumber(buffer, mimeType)) {
    throw new Error("O arquivo enviado nao parece ser uma imagem valida.");
  }

  return {
    buffer,
    mimeType,
    extension: mimeType === "image/jpeg" ? "jpg" : expectedExtension,
    sanitizedBaseName,
  };
}

export async function storeHotelImageFile(hotelId: string, file: File) {
  const { buffer, mimeType, extension, sanitizedBaseName } = await validateHotelImageFile(file);
  const safeHotelId = sanitizeStorageSegment(hotelId, "Hotel");
  const safeExtension = sanitizeStorageSegment(extension, "Extensao");
  const safeBaseName = sanitizeStorageSegment(sanitizedBaseName, "Nome do arquivo");
  const fileName = `${randomUUID()}-${safeBaseName}.${safeExtension}`;
  const storedObject = await getStorageProvider().putObject({
    key: path.posix.join("hotels", safeHotelId, fileName),
    body: buffer,
    contentType: mimeType,
    size: file.size,
  });

  return {
    url: storedObject.url,
    storageKey: storedObject.key,
    contentType: storedObject.contentType,
    size: storedObject.size,
  } satisfies StoredHotelImage;
}

export async function deleteStoredHotelImageFile(imageUrl: string) {
  return getStorageProvider().deleteObject({
    url: imageUrl,
  });
}
