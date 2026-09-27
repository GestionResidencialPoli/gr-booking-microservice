import type { AccessTokenClaims } from "../lib/token-service";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims | null;
      correlationId?: string;
    }
  }
}

export {};
