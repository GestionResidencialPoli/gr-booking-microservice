import type { IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";

export const STUB_PORT = 47123;
export const UID_SIN_APARTAMENTO = 99;
export const UID_APARTAMENTO_INACTIVO = 98;
export const UID_INEXISTENTE = 404;

export function apartamentoIdDe(uid: number): number {
  return Math.floor(uid / 10);
}

function usuario(uid: number) {
  const apartamentoId = apartamentoIdDe(uid);
  const apartment =
    uid === UID_SIN_APARTAMENTO
      ? null
      : {
          id: apartamentoId,
          torre: "T",
          numero: String(apartamentoId),
          activo: uid !== UID_APARTAMENTO_INACTIVO,
          tipoResidente: uid % 10 === 9 ? "ARRENDATARIO" : "PROPIETARIO",
        };
  return { id: uid, firstName: "Residente", lastName: String(uid), apartment };
}

function apartamento(torre: string, numero: string) {
  if (torre.toUpperCase() === "Z") return null;
  return { id: Number(numero) || 1, torre, numero, activo: numero !== "999" };
}

interface PeticionHub {
  id: string;
  action: string;
  payload: { id?: number; torre?: string; numero?: string };
}

function atender({ action, payload }: PeticionHub) {
  if (action === "users.get") {
    const uid = Number(payload.id);
    return uid === UID_INEXISTENTE ? null : usuario(uid);
  }
  if (action === "apartments.find") return apartamento(payload.torre ?? "", payload.numero ?? "");
  return null;
}

export function iniciarUserServiceStub(token: string): Promise<WebSocketServer> {
  const server = new WebSocketServer({
    port: STUB_PORT,
    host: "127.0.0.1",
    path: "/internal/ws",
    verifyClient: ({ req }: { req: IncomingMessage }) => req.headers["x-internal-token"] === token,
  });

  server.on("connection", (socket) => {
    socket.on("message", (data) => {
      const peticion = JSON.parse(data.toString()) as PeticionHub;
      const encontrado = atender(peticion);
      socket.send(
        JSON.stringify(
          encontrado
            ? { type: "response", id: peticion.id, ok: true, payload: encontrado }
            : { type: "response", id: peticion.id, ok: false, error: { code: "NO_ENCONTRADO", message: "No existe." } },
        ),
      );
    });
  });

  return new Promise((resolve) => server.once("listening", () => resolve(server)));
}
