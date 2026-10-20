import type { Request } from "express";
import type { AccessTokenClaims, UserRole } from "./token-service";

class Session {
  public static of(req: Request): AccessTokenClaims {
    return req.auth as AccessTokenClaims;
  }

  public static tieneRol(req: Request, rol: UserRole): boolean {
    return req.auth?.roles.includes(rol) ?? false;
  }

  public static esAdministrador(req: Request): boolean {
    return Session.tieneRol(req, "ADMINISTRACION");
  }
}

export default Session;
