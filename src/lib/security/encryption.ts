import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(envName: string) {
  const rawKey = process.env[envName]?.trim();

  if (!rawKey) {
    throw new Error(`${envName} deve ser configurada.`);
  }

  const key = Buffer.from(rawKey, "base64");

  if (key.length !== 32) {
    throw new Error(`${envName} deve ter 32 bytes em base64.`);
  }

  return key;
}

export function encryptSecret(value: string, envName: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(envName), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string, envName: string) {
  const [ivPart, authTagPart, encryptedPart] = value.split(".");

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Segredo criptografado inválido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(envName),
    Buffer.from(ivPart, "base64url")
  );

  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
