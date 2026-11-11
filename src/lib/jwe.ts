import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "dir";
const ENCRYPTION = "A256GCM";
const NESTED_CONTENT_TYPE = "JWT";
const IV_BYTES = 12;
const TAG_BYTES = 16;

interface JweHeader {
  alg?: unknown;
  enc?: unknown;
  cty?: unknown;
  zip?: unknown;
}

function parseHeader(encodedHeader: string): JweHeader | null {
  try {
    const header: unknown = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    return typeof header === "object" && header !== null ? (header as JweHeader) : null;
  } catch {
    return null;
  }
}

export function encryptNestedJwt(signedToken: string, key: Buffer): string {
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: ALGORITHM, enc: ENCRYPTION, cty: NESTED_CONTENT_TYPE }),
  ).toString("base64url");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(encodedHeader, "ascii"));
  const ciphertext = Buffer.concat([cipher.update(signedToken, "utf8"), cipher.final()]);

  return [
    encodedHeader,
    "",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptNestedJwt(token: string, key: Buffer): string | null {
  const parts = token.split(".");
  if (parts.length !== 5) return null;

  const [encodedHeader, encryptedKey, encodedIv, encodedCiphertext, encodedTag] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const header = parseHeader(encodedHeader);
  if (
    !header ||
    header.alg !== ALGORITHM ||
    header.enc !== ENCRYPTION ||
    header.cty !== NESTED_CONTENT_TYPE ||
    header.zip !== undefined ||
    encryptedKey !== ""
  ) {
    return null;
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(encodedHeader, "ascii"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64url")), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
