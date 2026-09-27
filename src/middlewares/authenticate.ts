import type { NextFunction, Request, Response } from "express";
import config from "../config";
import TokenService from "../lib/token-service";

function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.accessTokenCookieName];

  req.auth = token ? TokenService.verifyAccessToken(token) : null;

  next();
}

export default authenticate;
