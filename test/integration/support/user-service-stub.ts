import http from "node:http";

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

function responder(res: http.ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

export function iniciarUserServiceStub(token: string): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    if (req.headers["x-internal-token"] !== token) return responder(res, 401);

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${STUB_PORT}`);
    const usuarioMatch = url.pathname.match(/^\/api\/v1\/internal\/users\/(\d+)$/);

    if (usuarioMatch) {
      const uid = Number(usuarioMatch[1]);
      return uid === UID_INEXISTENTE ? responder(res, 404) : responder(res, 200, usuario(uid));
    }

    if (url.pathname === "/api/v1/internal/apartments") {
      const encontrado = apartamento(url.searchParams.get("torre") ?? "", url.searchParams.get("numero") ?? "");
      return encontrado ? responder(res, 200, encontrado) : responder(res, 404);
    }

    return responder(res, 404);
  });

  return new Promise((resolve) => server.listen(STUB_PORT, "127.0.0.1", () => resolve(server)));
}
