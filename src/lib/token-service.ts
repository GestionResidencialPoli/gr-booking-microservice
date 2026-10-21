import jwt, { type JwtPayload } from "jsonwebtoken";
import config from "../config";

export type UserRole = "ADMINISTRACION" | "VIGILANTE" | "RESIDENTE";

export interface AccessTokenClaims {
  sub: string;
  uid: number;
  roles: UserRole[];
  tipoResidente?: string;
}

function isAccessTokenClaims(payload: JwtPayload): payload is JwtPayload & AccessTokenClaims {
  return (
    typeof payload.sub === "string" &&
    typeof payload.uid === "number" &&
    Array.isArray(payload.roles) &&
    payload.roles.every((role: unknown) => typeof role === "string")
  );
}

class TokenService {
  public static verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });

      if (typeof payload === "string" || !isAccessTokenClaims(payload)) {
        return null;
      }

      return {
        sub: payload.sub,
        uid: payload.uid,
        roles: payload.roles,
        tipoResidente: payload.tipoResidente,
      };
    } catch {
      return null;
    }
  }
}

export default TokenService;
