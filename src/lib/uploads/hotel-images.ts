import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_STORAGE_PROVIDER = "local";
const LOCAL_PUBLIC_UPLOAD_PREFIX = "/uploads/hotels/";

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

type ImageStorageProvider = {
  storeHotelImage(input: {
    hotelId: string;
    buffer: Uint8Array;
    mimeType: string;
    extension: string;
    sanitizedBaseName: string;
    size: number;
  }): Promise<StoredHotelImage>;
  deleteHotelImage(imageUrl: string): Promise<{ status: "removed" | "missing" | "skipped" }>;
};

function getMaxImageSizeBytes() {
  const rawValue = process.env.UPLOAD_MAX_IMAGE_SIZE_BYTES?.trim();

  if (!rawValue) {
    return DEFAULT_MAX_IMAGE_SIZE_BYTES;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_MAX_IMAGE_SIZE_BYTES;
}

function getMaxImageSizeLabel(bytes: number) {
  const megaBytes = bytes / (1024 * 1024);

  return Number.isInteger(megaBytes) ? `${megaBytes} MB` : `${megaBytes.toFixed(1)} MB`;
}

function getStorageProviderName() {
  return (process.env.UPLOAD_STORAGE_PROVIDER?.trim() || DEFAULT_STORAGE_PROVIDER).toLowerCase();
}

function sanitizeStorageSegment(value: string, label: string) {
  const sanitized = value.trim();

  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(sanitized)) {
    throw new Error(`${label} inválido para armazenamento.`);
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
  const normalizedName = path
    .basename(fileName)
    .replace(/[\u0000-\u001F\u007F]+/g, "")
    .trim();

  if (!normalizedName || normalizedName.length > 180) {
    throw new Error("O arquivo precisa ter um nome válido.");
  }

  const parts = normalizedName
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error("O arquivo precisa ter uma extensão válida.");
  }

  const baseName = parts[0];
  const extension = parts.at(-1)?.toLowerCase() ?? "";
  const intermediateExtensions = parts.slice(1, -1).map((part) => part.toLowerCase());

  if (!baseName) {
    throw new Error("O arquivo precisa ter um nome válido.");
  }

  if (!extension) {
    throw new Error("O arquivo precisa ter uma extensão válida.");
  }

  if (intermediateExtensions.some((part) => suspiciousExtensions.has(part))) {
    throw new Error("Nome de arquivo inválido. Remova extensões suspeitas e tente novamente.");
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

const localStorageProvider: ImageStorageProvider = {
  async storeHotelImage({ hotelId, buffer, mimeType, extension, sanitizedBaseName, size }) {
    const safeHotelId = sanitizeStorageSegment(hotelId, "Hotel");
    const safeExtension = sanitizeStorageSegment(extension, "Extensão");
    const safeBaseName = sanitizeStorageSegment(sanitizedBaseName, "Nome do arquivo");
    const fileName = `${randomUUID()}-${safeBaseName}.${safeExtension}`;
    const relativeDir = path.posix.join("uploads", "hotels", safeHotelId);
    const relativePath = path.posix.join(relativeDir, fileName);
    const outputDir = path.join(process.cwd(), "public", "uploads", "hotels", safeHotelId);
    const outputPath = path.join(outputDir, fileName);

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, buffer);

    return {
      url: `/${relativePath}`,
      storageKey: relativePath,
      contentType: mimeType,
      size,
    };
  },

  async deleteHotelImage(imageUrl) {
    if (!imageUrl.startsWith(LOCAL_PUBLIC_UPLOAD_PREFIX)) {
      return { status: "skipped" };
    }

    const relativePath = imageUrl.replace(/^\//, "").split("/").join(path.sep);
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads", "hotels");
    const absolutePath = path.resolve(process.cwd(), "public", relativePath);

    if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new Error("Caminho de imagem inválido para remoção.");
    }

    try {
      await rm(absolutePath, { force: false });
      return { status: "removed" };
    } catch (error) {
      const errorCode =
        typeof error === "object" && error && "code" in error ? String(error.code) : null;

      if (errorCode === "ENOENT") {
        return { status: "missing" };
      }

      throw error;
    }
  },
};

const externalUrlProvider: ImageStorageProvider = {
  async storeHotelImage() {
    throw new Error(
      "Storage externo ainda não configurado. Use UPLOAD_STORAGE_PROVIDER=local com disco persistente ou cadastre URLs externas manualmente até integrar S3, R2 ou Supabase Storage."
    );
  },

  async deleteHotelImage(imageUrl) {
    if (imageUrl.startsWith(LOCAL_PUBLIC_UPLOAD_PREFIX)) {
      return localStorageProvider.deleteHotelImage(imageUrl);
    }

    return { status: "skipped" };
  },
};

function getImageStorageProvider(): ImageStorageProvider {
  const provider = getStorageProviderName();

  if (provider === "local") {
    return localStorageProvider;
  }

  if (provider === "external_url") {
    return externalUrlProvider;
  }

  throw new Error("UPLOAD_STORAGE_PROVIDER inválido. Use local ou external_url.");
}

export async function validateHotelImageFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error("Selecione uma imagem válida.");
  }

  const maxImageSizeBytes = getMaxImageSizeBytes();

  if (file.size > maxImageSizeBytes) {
    throw new Error(`A imagem excede o limite de ${getMaxImageSizeLabel(maxImageSizeBytes)}.`);
  }

  const mimeType = file.type.toLowerCase();
  const { extension, sanitizedBaseName } = parseFileName(file.name);

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("Formato inválido. Use JPG, JPEG, PNG ou WEBP.");
  }

  if (!allowedExtensions.has(extension)) {
    throw new Error("Extensão inválida. Use JPG, JPEG, PNG ou WEBP.");
  }

  const expectedExtension = allowedMimeTypes.get(mimeType);

  if (
    !expectedExtension ||
    (extension !== expectedExtension && !(mimeType === "image/jpeg" && extension === "jpeg"))
  ) {
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
    sanitizedBaseName,
  };
}

export async function storeHotelImageFile(hotelId: string, file: File) {
  const { buffer, mimeType, extension, sanitizedBaseName } = await validateHotelImageFile(file);
  const provider = getImageStorageProvider();

  return provider.storeHotelImage({
    hotelId,
    buffer,
    mimeType,
    extension,
    sanitizedBaseName,
    size: file.size,
  });
}

export async function deleteStoredHotelImageFile(imageUrl: string) {
  const provider = getImageStorageProvider();

  return provider.deleteHotelImage(imageUrl);
}
