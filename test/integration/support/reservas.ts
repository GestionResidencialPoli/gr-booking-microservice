import request from "supertest";
import { expect } from "vitest";
import Calendario from "../../../src/lib/calendario";
import server from "../../../src/server";
import { zonaPayload } from "./datos";
import { administrador, residente } from "./session";

const app = server.httpServer;
const admin = administrador();

export function fechaEn(dias: number): string {
  return Calendario.sumarDias(Calendario.fechaLocal(new Date()), dias);
}

export async function crearZona(overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await request(app)
    .post("/api/v1/zonas-comunes")
    .set("Cookie", admin.cookie)
    .set("X-XSRF-TOKEN", admin.csrf)
    .send(zonaPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.payload.id;
}

export function reservar(uid: number, zonaId: number, fecha: string, horaInicio: string) {
  const session = residente(uid);
  return request(app)
    .post("/api/v1/reservas")
    .set("Cookie", session.cookie)
    .set("X-XSRF-TOKEN", session.csrf)
    .send({ zonaId, fecha, horaInicio });
}
