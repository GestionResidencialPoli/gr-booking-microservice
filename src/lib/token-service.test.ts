import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import config from "../config";
import TokenService from "./token-service";

const payload = { sub: "1", uid: 1, roles: ["RESIDENTE"] };

function sign(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = {}) {
  return jwt.sign({ ...payload, ...overrides }, config.jwtSecret, { algorithm: "HS256", ...options });
}

describe("TokenService.verifyAccessToken", () => {
  it("devuelve los claims de un token valido", () => {
    const claims = TokenService.verifyAccessToken(sign());

    expect(claims).toEqual({ sub: "1", uid: 1, roles: ["RESIDENTE"], tipoResidente: undefined });
  });

  it("devuelve null si la firma no coincide con el secreto configurado", () => {
    const tampered = jwt.sign(payload, "otro-secreto-completamente-distinto-de-32-caracteres", { algorithm: "HS256" });

    expect(TokenService.verifyAccessToken(tampered)).toBeNull();
  });

  it("devuelve null si el token ya expiro", () => {
    const expired = sign({}, { expiresIn: -10 });

    expect(TokenService.verifyAccessToken(expired)).toBeNull();
  });

  it("devuelve null si el payload no tiene la forma esperada (falta uid)", () => {
    const malformed = jwt.sign({ sub: "1", roles: ["RESIDENTE"] }, config.jwtSecret, { algorithm: "HS256" });

    expect(TokenService.verifyAccessToken(malformed)).toBeNull();
  });

  it("devuelve null ante un token que no es JWT", () => {
    expect(TokenService.verifyAccessToken("no-soy-un-jwt")).toBeNull();
  });
});
