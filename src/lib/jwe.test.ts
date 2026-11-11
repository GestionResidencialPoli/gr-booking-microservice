import { describe, expect, it } from "vitest";
import { decryptNestedJwt, encryptNestedJwt } from "./jwe";

const key = Buffer.alloc(32, 1);
const signed = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3VhcmlvQGV4YW1wbGUuY29tIn0.firma";

describe("JWE anidado (dir + A256GCM)", () => {
  it("cifra en formato compacto de 5 segmentos con la cabecera esperada y sin claims legibles", () => {
    const token = encryptNestedJwt(signed, key);
    const [header = "", encryptedKey, , ciphertext = ""] = token.split(".");

    expect(token.split(".")).toHaveLength(5);
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "dir", enc: "A256GCM", cty: "JWT" });
    expect(encryptedKey).toBe("");
    expect(Buffer.from(ciphertext, "base64url").toString()).not.toContain("usuario@example.com");
  });

  it("descifra lo que cifra con la misma clave", () => {
    expect(decryptNestedJwt(encryptNestedJwt(signed, key), key)).toBe(signed);
  });

  it("rechaza un token cifrado con otra clave", () => {
    expect(decryptNestedJwt(encryptNestedJwt(signed, Buffer.alloc(32, 2)), key)).toBeNull();
  });

  it("rechaza un token cuyo contenido cifrado fue alterado", () => {
    const parts = encryptNestedJwt(signed, key).split(".");
    const bytes = Buffer.from(parts[3] ?? "", "base64url");
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    parts[3] = bytes.toString("base64url");

    expect(decryptNestedJwt(parts.join("."), key)).toBeNull();
  });

  it("rechaza una cabecera con otro algoritmo aunque el resto sea valido", () => {
    const parts = encryptNestedJwt(signed, key).split(".");
    parts[0] = Buffer.from(JSON.stringify({ alg: "A256KW", enc: "A256GCM", cty: "JWT" })).toString("base64url");

    expect(decryptNestedJwt(parts.join("."), key)).toBeNull();
  });

  it("rechaza un JWS plano y basura", () => {
    expect(decryptNestedJwt(signed, key)).toBeNull();
    expect(decryptNestedJwt("a.b.c.d.e", key)).toBeNull();
  });
});
