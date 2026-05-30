export type StorageProviderName = "local" | "s3" | "r2" | "supabase";

export type StoragePutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
  size: number;
};

export type StoredObject = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

export type StorageDeleteObjectInput = {
  key?: string;
  url?: string;
};

export type StorageDeleteObjectResult = {
  status: "removed" | "missing" | "skipped";
};

export interface StorageProvider {
  putObject(input: StoragePutObjectInput): Promise<StoredObject>;
  deleteObject(input: StorageDeleteObjectInput): Promise<StorageDeleteObjectResult>;
}
