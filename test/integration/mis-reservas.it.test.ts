import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import server from "../../src/server";
import { enDias, insertarReservaConfirmada } from "./support/datos";
import { crearZona, fechaEn, reservar } from "./support/reservas";
import { residente } from "./support/session";
import { apartamentoIdDe } from "./support/user-service-stub";

const app = server.app;

interface ReservaRespuesta {
  id: number;
  estado: string;
  fecha: string;
  zona: { nombre: string };
}

function misReservas(uid: number) {
  return request(app).get("/api/v1/reservas/mias").set("Cookie", residente(uid).cookie);
}

describe("HU-3.5 consultar mis reservas", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 y CA-2 muestra solo las reservas del apartamento, separadas y con las proximas en orden ascendente", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const lejana = await reservar(5011, zonaId, fechaEn(9), "08:00");
    const cercana = await reservar(5011, zonaId, fechaEn(2), "08:00");
    await reservar(5021, zonaId, fechaEn(3), "08:00");
    const pasada = await insertarReservaConfirmada(zonaId, enDias(-3, "08:00"), enDias(-3, "10:00"), apartamentoIdDe(5011), 5);

    const res = await misReservas(5011);

    expect(res.status).toBe(200);
    expect(res.body.payload.apartamento.id).toBe(apartamentoIdDe(5011));
    expect(res.body.payload.proximas.map((reserva: ReservaRespuesta) => reserva.id)).toEqual([
      cercana.body.payload.id,
      lejana.body.payload.id,
    ]);
    expect(res.body.payload.pasadas.map((reserva: ReservaRespuesta) => reserva.id)).toEqual([pasada]);
    expect(res.body.payload.proximas[0].zona.nombre).toBeTruthy();
  });

  it("CA-3 una reserva cancelada aparece con el estado CANCELADA", async () => {
    const zonaId = await crearZona();
    const creada = await reservar(5031, zonaId, fechaEn(4), "08:00");
    const session = residente(5031);
    await request(app)
      .patch(`/api/v1/reservas/${creada.body.payload.id}/cancelacion`)
      .set("Cookie", session.cookie)
      .set("X-XSRF-TOKEN", session.csrf)
      .send({});

    const res = await misReservas(5031);

    expect(res.body.payload.proximas).toEqual([expect.objectContaining({ id: creada.body.payload.id, estado: "CANCELADA" })]);
  });

  it("CA-4 sin reservas devuelve listas vacias para que la interfaz muestre el estado vacio", async () => {
    const res = await misReservas(5041);

    expect(res.status).toBe(200);
    expect(res.body.payload.proximas).toEqual([]);
    expect(res.body.payload.pasadas).toEqual([]);
  });

  it("CA-5 el arrendatario del mismo apartamento ve las reservas creadas por el propietario", async () => {
    const zonaId = await crearZona();
    const delPropietario = await reservar(5051, zonaId, fechaEn(4), "10:00");

    const res = await misReservas(5059);

    expect(res.body.payload.proximas.map((reserva: ReservaRespuesta) => reserva.id)).toContain(delPropietario.body.payload.id);
  });
});
