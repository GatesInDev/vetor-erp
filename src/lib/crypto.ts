import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must contain 32 bytes");
  return key;
}

export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(value: string): string {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
