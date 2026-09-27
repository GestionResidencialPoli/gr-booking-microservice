import type { NextFunction, Request, Response } from "express";
import HttpStatus from "../types/enums/http-status";

function requireAuthentication(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(HttpStatus.Unauthorized).json({
      error: { code: "NO_AUTENTICADO", message: "Se requiere autenticacion para acceder a este recurso." },
    });
    return;
  }

  next();
}

export default requireAuthentication;
