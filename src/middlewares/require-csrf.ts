import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import HttpStatus from "../types/enums/http-status";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "x-xsrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameToken(cookieToken: string, headerToken: string): boolean {
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  return cookieBuffer.length === headerBuffer.length && timingSafeEqual(cookieBuffer, headerBuffer);
}

function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.header(CSRF_HEADER);

  if (typeof cookieToken !== "string" || !headerToken || !sameToken(cookieToken, headerToken)) {
    res.status(HttpStatus.Forbidden).json({
      error: { code: "CSRF_INVALIDO", message: "Falta o no coincide el token CSRF de la solicitud." },
    });
    return;
  }

  next();
}

export default requireCsrf;
