import { LocalStorageProvider } from "./local";
import {
  CloudflareR2StorageProvider,
  S3StorageProvider,
  SupabaseStorageProvider,
} from "./remote-placeholders";
import type { StorageProvider, StorageProviderName } from "./types";

export type {
  StorageDeleteObjectInput,
  StorageDeleteObjectResult,
  StorageProvider,
  StorageProviderName,
  StoragePutObjectInput,
  StoredObject,
} from "./types";
export { LocalStorageProvider } from "./local";
export {
  CloudflareR2StorageProvider,
  S3StorageProvider,
  SupabaseStorageProvider,
} from "./remote-placeholders";

const DEFAULT_STORAGE_PROVIDER: StorageProviderName = "local";

function getStorageProviderName(): StorageProviderName {
  const rawProvider = (
    process.env.STORAGE_PROVIDER ||
    process.env.UPLOAD_STORAGE_PROVIDER ||
    DEFAULT_STORAGE_PROVIDER
  )
    .trim()
    .toLowerCase();

  if (rawProvider === "local" || rawProvider === "s3" || rawProvider === "r2") {
    return rawProvider;
  }

  if (rawProvider === "supabase" || rawProvider === "supabase_storage") {
    return "supabase";
  }

  throw new Error("STORAGE_PROVIDER invalido. Use local, s3, r2 ou supabase.");
}

export function createStorageProvider(name: StorageProviderName = getStorageProviderName()) {
  if (name === "local") {
    return new LocalStorageProvider();
  }

  if (name === "s3") {
    return new S3StorageProvider();
  }

  if (name === "r2") {
    return new CloudflareR2StorageProvider();
  }

  return new SupabaseStorageProvider();
}

let storageProvider: StorageProvider | null = null;

export function getStorageProvider() {
  storageProvider ??= createStorageProvider();

  return storageProvider;
}

export function setStorageProviderForTesting(provider: StorageProvider | null) {
  storageProvider = provider;
}
