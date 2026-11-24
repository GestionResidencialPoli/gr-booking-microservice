import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import config from "../config";
import Logger from "./logger";

const SERVICE_NAME = "booking-microservice";
const RECONNECT_DELAY_MS = 3_000;

interface ResponseFrame {
  type: string;
  id?: string;
  ok?: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: CommunicationsError) => void;
  timer: NodeJS.Timeout;
}

export class CommunicationsError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CommunicationsError";
  }
}

class CommunicationsClient {
  private static socket: WebSocket | null = null;

  private static connecting: Promise<WebSocket> | null = null;

  private static reconnectTimer: NodeJS.Timeout | undefined;

  private static active = false;

  private static readonly pending = new Map<string, PendingRequest>();

  public static start(): void {
    this.active = true;
    this.connect().catch((error: Error) => {
      Logger.warn("Hub de comunicaciones no disponible, se reintenta", { error: error.message });
    });
  }

  public static stop(): void {
    this.active = false;
    clearTimeout(this.reconnectTimer);
    this.socket?.terminate();
  }

  public static async request<T>(target: string, action: string, payload: unknown): Promise<T> {
    const socket = await this.connect();
    const id = randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.settle(id)?.reject(new CommunicationsError("TIEMPO_AGOTADO", `${target} no respondio a tiempo.`));
      }, config.communications.timeoutMs);

      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      socket.send(JSON.stringify({ type: "request", id, target, action, payload }), (error) => {
        if (error) this.settle(id)?.reject(new CommunicationsError("HUB_NO_DISPONIBLE", error.message));
      });
    });
  }

  private static connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve(this.socket);
    if (!this.connecting) {
      this.connecting = this.open().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private static open(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(config.communications.url, {
        headers: { "X-Internal-Token": config.communications.internalToken, "X-Service-Name": SERVICE_NAME },
        handshakeTimeout: config.communications.timeoutMs,
      });

      socket.once("open", () => {
        this.socket = socket;
        resolve(socket);
      });
      socket.on("message", (data) => this.receive(data.toString()));
      socket.on("error", (error) => reject(new CommunicationsError("HUB_NO_DISPONIBLE", error.message)));
      socket.once("close", () => this.handleClose(socket));
      this.watch(socket);
    });
  }

  private static watch(socket: WebSocket): void {
    let timer = setTimeout(() => socket.terminate(), config.communications.silenceLimitMs);
    const renew = () => {
      clearTimeout(timer);
      timer = setTimeout(() => socket.terminate(), config.communications.silenceLimitMs);
    };

    socket.on("ping", renew);
    socket.on("message", renew);
    socket.once("close", () => clearTimeout(timer));
  }

  private static receive(data: string): void {
    let frame: ResponseFrame;
    try {
      frame = JSON.parse(data) as ResponseFrame;
    } catch {
      return;
    }
    if (frame.type !== "response" || !frame.id) return;

    const request = this.settle(frame.id);
    if (!request) return;

    if (frame.ok) {
      request.resolve(frame.payload);
      return;
    }
    request.reject(
      new CommunicationsError(frame.error?.code ?? "ERROR_INTERNO", frame.error?.message ?? "Respuesta invalida."),
    );
  }

  private static settle(id: string): PendingRequest | undefined {
    const request = this.pending.get(id);
    if (request) {
      clearTimeout(request.timer);
      this.pending.delete(id);
    }
    return request;
  }

  private static handleClose(socket: WebSocket): void {
    if (this.socket === socket) {
      this.socket = null;
      for (const id of [...this.pending.keys()]) {
        this.settle(id)?.reject(new CommunicationsError("HUB_NO_DISPONIBLE", "Se perdio la conexion con el hub."));
      }
    }
    if (!this.active) return;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.start(), RECONNECT_DELAY_MS);
  }
}

export default CommunicationsClient;
