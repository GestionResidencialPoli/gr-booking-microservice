import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import DomainError from "../lib/domain-error";
import Logger from "../lib/logger";
import HttpStatus from "../types/enums/http-status";

function handleError(error: Error, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(HttpStatus.BadRequest).json({
      error: {
        code: "SOLICITUD_INVALIDA",
        message: "La solicitud no es valida.",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(HttpStatus.BadRequest).json({
      error: { code: "SOLICITUD_INVALIDA", message: "El cuerpo de la solicitud no es un JSON valido." },
    });
    return;
  }

  Logger.error(error, { url: req.originalUrl, method: req.method });
  res.status(HttpStatus.InternalServerError).json({
    error: { code: "ERROR_INTERNO", message: "Error interno del servicio." },
  });
}

export default handleError;
