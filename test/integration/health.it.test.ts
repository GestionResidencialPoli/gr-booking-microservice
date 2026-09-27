import request from "supertest";
import { describe, expect, it } from "vitest";
import server from "../../src/server";
import { residente } from "./support/session";

const app = server.httpServer;

describe("esqueleto del servicio", () => {
  it("responde /health sin sesion", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("responde /health/ready cuando la base de datos esta disponible", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
  });

  it("rechaza la API sin cookie de sesion con 401 y un codigo identificable", async () => {
    const res = await request(app).get("/api/v1/cualquier-recurso");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NO_AUTENTICADO");
  });

  it("rechaza una mutacion sin el encabezado CSRF", async () => {
    const session = residente(1);
    const res = await request(app).post("/api/v1/cualquier-recurso").set("Cookie", session.cookie).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_INVALIDO");
  });

  it("propaga el identificador de correlacion recibido", async () => {
    const res = await request(app).get("/health").set("X-Correlation-Id", "abc-123");
    expect(res.headers["x-correlation-id"]).toBe("abc-123");
  });
});
