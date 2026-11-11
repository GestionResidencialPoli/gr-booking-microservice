import jwt from "jsonwebtoken";
import type { UserRole } from "../../../src/lib/token-service";
import { encryptNestedJwt } from "../../../src/lib/jwe";

const CSRF_TOKEN = "csrf-token-de-prueba";

export interface TestSession {
  cookie: string;
  csrf: string;
}

export function sessionFor(uid: number, roles: UserRole[], email = `usuario${uid}@gr.test`): TestSession {
  const secret = process.env.JWT_SECRET as string;
  const encryptionKey = Buffer.from(process.env.JWT_ENCRYPTION_KEY as string, "base64url");
  const token = encryptNestedJwt(
    jwt.sign({ sub: email, uid, roles }, secret, { algorithm: "HS256", expiresIn: "15m" }),
    encryptionKey,
  );
  return { cookie: `access_token=${token}; XSRF-TOKEN=${CSRF_TOKEN}`, csrf: CSRF_TOKEN };
}

export const residente = (uid: number) => sessionFor(uid, ["RESIDENTE"]);
export const administrador = (uid = 900) => sessionFor(uid, ["ADMINISTRACION"]);
export const vigilante = (uid = 800) => sessionFor(uid, ["VIGILANTE"]);
