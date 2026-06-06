import { del, put } from "@vercel/blob";

import type {
  StorageDeleteObjectInput,
  StorageDeleteObjectResult,
  StorageProvider,
  StoragePutObjectInput,
  StoredObject,
} from "./types";

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error("Storage de imagens não configurado.");
  }

  return token;
}

function normalizeObjectKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Chave de storage inválida.");
  }

  return normalized;
}

export class VercelBlobStorageProvider implements StorageProvider {
  async putObject({ key, body, contentType, size }: StoragePutObjectInput): Promise<StoredObject> {
    const safeKey = normalizeObjectKey(key);
    const blob = await put(safeKey, new Blob([Buffer.from(body)], { type: contentType }), {
      access: "public",
      contentType,
      token: getBlobToken(),
    });

    return {
      key: safeKey,
      url: blob.url,
      contentType,
      size,
    };
  }

  async deleteObject({ key, url }: StorageDeleteObjectInput): Promise<StorageDeleteObjectResult> {
    const target = url ?? key;

    if (!target) {
      return { status: "skipped" };
    }

    await del(target, {
      token: getBlobToken(),
    });

    return { status: "removed" };
  }
}
