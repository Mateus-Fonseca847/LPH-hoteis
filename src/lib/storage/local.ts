import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  StorageDeleteObjectInput,
  StorageDeleteObjectResult,
  StorageProvider,
  StoragePutObjectInput,
  StoredObject,
} from "./types";

const LOCAL_PUBLIC_UPLOAD_PREFIX = "/uploads/";

function normalizeObjectKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Chave de storage invalida.");
  }

  return normalized;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;
  private readonly publicPrefix: string;

  constructor({
    rootDir = path.join(process.cwd(), "public", "uploads"),
    publicPrefix = LOCAL_PUBLIC_UPLOAD_PREFIX,
  }: {
    rootDir?: string;
    publicPrefix?: string;
  } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.publicPrefix = publicPrefix.endsWith("/") ? publicPrefix : `${publicPrefix}/`;
  }

  async putObject({ key, body, contentType, size }: StoragePutObjectInput): Promise<StoredObject> {
    const safeKey = normalizeObjectKey(key);
    const absolutePath = this.resolveKey(safeKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);

    return {
      key: safeKey,
      url: `${this.publicPrefix}${safeKey}`,
      contentType,
      size,
    };
  }

  async deleteObject({ key, url }: StorageDeleteObjectInput): Promise<StorageDeleteObjectResult> {
    const resolvedKey = key ?? this.getKeyFromUrl(url);

    if (!resolvedKey) {
      return { status: "skipped" };
    }

    const absolutePath = this.resolveKey(normalizeObjectKey(resolvedKey));

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
  }

  private getKeyFromUrl(url?: string) {
    if (!url?.startsWith(this.publicPrefix)) {
      return null;
    }

    return url.slice(this.publicPrefix.length);
  }

  private resolveKey(key: string) {
    const absolutePath = path.resolve(this.rootDir, key.split("/").join(path.sep));

    if (absolutePath !== this.rootDir && !absolutePath.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new Error("Caminho de storage invalido.");
    }

    return absolutePath;
  }
}
