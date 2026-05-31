import { createHash, createHmac } from "node:crypto";

import type {
  StorageDeleteObjectInput,
  StorageDeleteObjectResult,
  StorageProvider,
  StoragePutObjectInput,
  StoredObject,
} from "./types";

type S3StorageProviderConfig = {
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  region?: string;
};

const SERVICE = "s3";
const DEFAULT_REGION = "us-east-1";

function getRequiredConfig(name: string, value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`${name} nao configurado.`);
  }

  return trimmed;
}

function normalizeEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";

  return url;
}

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

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeKeyPath(key: string) {
  return key.split("/").map(encodePathSegment).join("/");
}

function sha256Hex(input: string | Uint8Array) {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function buildPublicUrl(publicBaseUrl: string, key: string) {
  return `${publicBaseUrl.replace(/\/+$/, "")}/${encodeKeyPath(key)}`;
}

export class S3StorageProvider implements StorageProvider {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl: string;
  private readonly region: string;

  constructor(config: S3StorageProviderConfig = {}) {
    this.endpoint = normalizeEndpoint(
      getRequiredConfig("S3_ENDPOINT", config.endpoint ?? process.env.S3_ENDPOINT)
    );
    this.bucket = getRequiredConfig("S3_BUCKET", config.bucket ?? process.env.S3_BUCKET);
    this.accessKeyId = getRequiredConfig(
      "S3_ACCESS_KEY_ID",
      config.accessKeyId ?? process.env.S3_ACCESS_KEY_ID
    );
    this.secretAccessKey = getRequiredConfig(
      "S3_SECRET_ACCESS_KEY",
      config.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY
    );
    this.publicBaseUrl = getRequiredConfig(
      "S3_PUBLIC_BASE_URL",
      config.publicBaseUrl ?? process.env.S3_PUBLIC_BASE_URL
    );
    this.region = (config.region ?? process.env.S3_REGION ?? DEFAULT_REGION).trim() || DEFAULT_REGION;
  }

  async putObject({
    key,
    body,
    contentType,
    size,
  }: StoragePutObjectInput): Promise<StoredObject> {
    const safeKey = normalizeObjectKey(key);
    const payloadHash = sha256Hex(body);
    const response = await fetch(this.buildObjectUrl(safeKey), {
      method: "PUT",
      headers: this.buildSignedHeaders({
        method: "PUT",
        key: safeKey,
        payloadHash,
        contentType,
      }),
      body: new Blob([Buffer.from(body)], { type: contentType }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar objeto para S3 (${response.status}).`);
    }

    return {
      key: safeKey,
      url: buildPublicUrl(this.publicBaseUrl, safeKey),
      contentType,
      size,
    };
  }

  async deleteObject({ key, url }: StorageDeleteObjectInput): Promise<StorageDeleteObjectResult> {
    const safeKey = key ? normalizeObjectKey(key) : this.getKeyFromPublicUrl(url);

    if (!safeKey) {
      return { status: "skipped" };
    }

    const payloadHash = sha256Hex("");
    const response = await fetch(this.buildObjectUrl(safeKey), {
      method: "DELETE",
      headers: this.buildSignedHeaders({
        method: "DELETE",
        key: safeKey,
        payloadHash,
      }),
    });

    if (response.status === 404) {
      return { status: "missing" };
    }

    if (!response.ok && response.status !== 204) {
      throw new Error(`Falha ao remover objeto do S3 (${response.status}).`);
    }

    return { status: "removed" };
  }

  private buildObjectUrl(key: string) {
    const url = new URL(this.endpoint);
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/${encodePathSegment(this.bucket)}/${encodeKeyPath(key)}`;

    return url;
  }

  private getKeyFromPublicUrl(url?: string) {
    if (!url) {
      return null;
    }

    const publicBase = new URL(this.publicBaseUrl);
    const target = new URL(url, publicBase);

    if (target.origin !== publicBase.origin) {
      return null;
    }

    const basePath = publicBase.pathname.replace(/\/+$/, "");

    if (basePath && !target.pathname.startsWith(`${basePath}/`)) {
      return null;
    }

    const keyPath = basePath ? target.pathname.slice(basePath.length + 1) : target.pathname.slice(1);

    return keyPath ? normalizeObjectKey(decodeURIComponent(keyPath)) : null;
  }

  private buildSignedHeaders({
    method,
    key,
    payloadHash,
    contentType,
  }: {
    method: "PUT" | "DELETE";
    key: string;
    payloadHash: string;
    contentType?: string;
  }) {
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const objectUrl = this.buildObjectUrl(key);
    const headers: Record<string, string> = {
      host: objectUrl.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };

    if (contentType) {
      headers["content-type"] = contentType;
    }

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name].trim()}\n`)
      .join("");
    const canonicalRequest = [
      method,
      objectUrl.pathname,
      "",
      canonicalHeaders,
      signedHeaderNames.join(";"),
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.region}/${SERVICE}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = this.getSigningKey(dateStamp);
    const signature = hmacHex(signingKey, stringToSign);

    return {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(
        ";"
      )}, Signature=${signature}`,
    };
  }

  private getSigningKey(dateStamp: string) {
    const dateKey = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, this.region);
    const serviceKey = hmac(regionKey, SERVICE);

    return hmac(serviceKey, "aws4_request");
  }
}
