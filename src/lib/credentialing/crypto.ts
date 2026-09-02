import crypto from "crypto";

// AES-256-GCM at-rest encryption for portal credentials. The key is derived from
// CREDENTIALING_ENC_KEY (or AUTH_SECRET) so plaintext passwords are never stored.
function key(): Buffer {
  const secret = process.env.CREDENTIALING_ENC_KEY || process.env.AUTH_SECRET || "dev-insecure-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(blob: string | null | undefined): string {
  if (!blob || !blob.startsWith("v1:")) return "";
  try {
    const [, ivb, tagb, encb] = blob.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivb, "base64"));
    decipher.setAuthTag(Buffer.from(tagb, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encb, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function hasSecret(blob: string | null | undefined): boolean {
  return Boolean(blob && blob.startsWith("v1:"));
}
