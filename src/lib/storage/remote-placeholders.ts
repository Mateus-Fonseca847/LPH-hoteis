import type {
  StorageDeleteObjectInput,
  StorageDeleteObjectResult,
  StorageProvider,
  StoragePutObjectInput,
  StoredObject,
} from "./types";

class NotConfiguredStorageProvider implements StorageProvider {
  constructor(private readonly providerName: string) {}

  async putObject(input: StoragePutObjectInput): Promise<StoredObject> {
    void input;
    throw new Error(`${this.providerName} ainda nao configurado como StorageProvider.`);
  }

  async deleteObject(input: StorageDeleteObjectInput): Promise<StorageDeleteObjectResult> {
    void input;
    throw new Error(`${this.providerName} ainda nao configurado como StorageProvider.`);
  }
}

export class S3StorageProvider extends NotConfiguredStorageProvider {
  constructor() {
    super("S3");
  }
}

export class CloudflareR2StorageProvider extends NotConfiguredStorageProvider {
  constructor() {
    super("Cloudflare R2");
  }
}

export class SupabaseStorageProvider extends NotConfiguredStorageProvider {
  constructor() {
    super("Supabase Storage");
  }
}
