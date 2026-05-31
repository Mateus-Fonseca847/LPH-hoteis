import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
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
export { S3StorageProvider } from "./s3";

const DEFAULT_STORAGE_PROVIDER: StorageProviderName = "local";

function getStorageProviderName(): StorageProviderName {
  const rawProvider = (process.env.STORAGE_PROVIDER || DEFAULT_STORAGE_PROVIDER)
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
    if (process.env.NODE_ENV === "production") {
      throw new Error("Storage local e permitido apenas em desenvolvimento.");
    }

    return new LocalStorageProvider();
  }

  if (name === "s3" || name === "r2") {
    return new S3StorageProvider();
  }

  throw new Error("Supabase Storage nao esta implementado. Use STORAGE_PROVIDER=s3.");
}

let storageProvider: StorageProvider | null = null;

export function getStorageProvider() {
  storageProvider ??= createStorageProvider();

  return storageProvider;
}

export function setStorageProviderForTesting(provider: StorageProvider | null) {
  storageProvider = provider;
}
