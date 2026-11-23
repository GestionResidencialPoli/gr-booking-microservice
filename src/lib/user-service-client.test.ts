import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

const settings = vi.hoisted(() => ({
  communications: { url: "", internalToken: "token-interno", timeoutMs: 200, silenceLimitMs: 5_000 },
}));

vi.mock("../config", () => ({ default: settings }));

import CommunicationsClient from "./communications-client";
import UserServiceClient from "./user-service-client";

type Reply = (frame: { id: string }, socket: WebSocket) => void;

let hub: WebSocketServer;
let reply: Reply;
let headers: Record<string, unknown>;

describe("UserServiceClient", () => {
  beforeEach(async () => {
    hub = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise((resolve) => hub.once("listening", resolve));
    settings.communications.url = `ws://127.0.0.1:${(hub.address() as AddressInfo).port}/internal/ws`;
    hub.on("connection", (socket, request) => {
      headers = request.headers;
      socket.on("message", (data) => reply(JSON.parse(data.toString()), socket));
    });
  });

  afterEach(async () => {
    CommunicationsClient.stop();
    hub.clients.forEach((client) => client.terminate());
    await new Promise((resolve) => hub.close(resolve));
  });

  it("consulta al user-microservice por el hub", async () => {
    const frames: unknown[] = [];
    reply = (frame, socket) => {
      frames.push(frame);
      socket.send(JSON.stringify({ type: "response", id: frame.id, ok: true, payload: { id: 7, firstName: "Ana", lastName: "Ruiz", apartment: null } }));
    };

    expect(await UserServiceClient.residente(7)).toEqual({ userId: 7, nombre: "Ana Ruiz", apartamento: null });
    expect(frames[0]).toMatchObject({ target: "user-microservice", action: "users.get", payload: { id: 7 } });
    expect(headers).toMatchObject({ "x-internal-token": "token-interno", "x-service-name": "booking-microservice" });
  });

  it("distingue un recurso inexistente", async () => {
    reply = (frame, socket) =>
      socket.send(
        JSON.stringify({ type: "response", id: frame.id, ok: false, error: { code: "NO_ENCONTRADO", message: "x" } }),
      );
    await expect(UserServiceClient.residente(7)).rejects.toMatchObject({ statusCode: 422, code: "RESIDENTE_DESCONOCIDO" });
  });

  it("informa que el directorio no esta disponible cuando no hay respuesta", async () => {
    reply = () => undefined;
    await expect(UserServiceClient.residente(7)).rejects.toMatchObject({
      statusCode: 502,
      code: "DIRECTORIO_NO_DISPONIBLE",
    });
  });

  it("informa que el directorio no esta disponible cuando el hub no responde", async () => {
    settings.communications.url = "ws://127.0.0.1:1/internal/ws";
    await expect(UserServiceClient.residente(7)).rejects.toMatchObject({
      statusCode: 502,
      code: "DIRECTORIO_NO_DISPONIBLE",
    });
  });
});
