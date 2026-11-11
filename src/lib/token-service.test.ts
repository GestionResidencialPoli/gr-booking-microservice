import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import config from "../config";
import TokenService from "./token-service";
import { encryptNestedJwt } from "./jwe";

const payload = { sub: "1", uid: 1, roles: ["RESIDENTE"] };

function sign(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = {}) {
  return encryptNestedJwt(
    jwt.sign({ ...payload, ...overrides }, config.jwtSecret, { algorithm: "HS256", ...options }),
    config.jwtEncryptionKey,
  );
}

describe("TokenService.verifyAccessToken", () => {
  it("devuelve los claims de un token valido", () => {
    const claims = TokenService.verifyAccessToken(sign());

    expect(claims).toEqual({ sub: "1", uid: 1, roles: ["RESIDENTE"], tipoResidente: undefined });
  });

  it("devuelve null si la firma no coincide con el secreto configurado", () => {
    const tampered = encryptNestedJwt(
      jwt.sign(payload, "otro-secreto-completamente-distinto-de-32-caracteres", { algorithm: "HS256" }),
      config.jwtEncryptionKey,
    );

    expect(TokenService.verifyAccessToken(tampered)).toBeNull();
  });

  it("devuelve null si el token ya expiro", () => {
    const expired = sign({}, { expiresIn: -10 });

    expect(TokenService.verifyAccessToken(expired)).toBeNull();
  });

  it("devuelve null si el payload no tiene la forma esperada (falta uid)", () => {
    const malformed = encryptNestedJwt(
      jwt.sign({ sub: "1", roles: ["RESIDENTE"] }, config.jwtSecret, { algorithm: "HS256" }),
      config.jwtEncryptionKey,
    );

    expect(TokenService.verifyAccessToken(malformed)).toBeNull();
  });

  it("devuelve null ante un JWT firmado pero no cifrado", () => {
    const plain = jwt.sign(payload, config.jwtSecret, { algorithm: "HS256" });

    expect(TokenService.verifyAccessToken(plain)).toBeNull();
  });

  it("devuelve null si el token se cifro con otra clave", () => {
    const otherKey = Buffer.alloc(32, 7);
    const token = encryptNestedJwt(jwt.sign(payload, config.jwtSecret, { algorithm: "HS256" }), otherKey);

    expect(TokenService.verifyAccessToken(token)).toBeNull();
  });

  it("devuelve null ante un token que no es JWT", () => {
    expect(TokenService.verifyAccessToken("no-soy-un-jwt")).toBeNull();
  });
});
