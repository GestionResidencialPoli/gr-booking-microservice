import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import RequestContext from "../lib/request-context";

const CORRELATION_HEADER = "x-correlation-id";
const MAX_LENGTH = 100;

function correlationIdOf(req: Request): string {
  const incoming = req.header(CORRELATION_HEADER)?.trim();
  return incoming && incoming.length <= MAX_LENGTH ? incoming : randomUUID();
}

function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = correlationIdOf(req);
  req.correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);
  RequestContext.run(id, next);
}

export default correlationId;
