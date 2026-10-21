import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import server from "../../src/server";
import { enDias, insertarReservaConfirmada } from "./support/datos";
import { crearZona, fechaEn, reservar } from "./support/reservas";
import { residente } from "./support/session";
import { apartamentoIdDe } from "./support/user-service-stub";

const app = server.httpServer;

function cancelar(uid: number, reservaId: number) {
  const session = residente(uid);
  return request(app)
    .patch(`/api/v1/reservas/${reservaId}/cancelacion`)
    .set("Cookie", session.cookie)
    .set("X-XSRF-TOKEN", session.csrf)
    .send({});
}

async function ocupadosDe(zonaId: number): Promise<number> {
  const franja = await knex("franjas_ocupacion").where({ zona_id: zonaId }).first();
  return franja.ocupados;
}

describe("HU-3.4 cancelar una reserva propia", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 y CA-2 cancelar con anticipacion suficiente deja la reserva CANCELADA y el cupo libre para otros", async () => {
    const zonaId = await crearZona({ aforo: 1, anticipacionCancelacionHoras: 24 });
    const fecha = fechaEn(5);
    const creada = await reservar(4011, zonaId, fecha, "10:00");

    const res = await cancelar(4011, creada.body.payload.id);

    expect(res.status).toBe(200);
    expect(res.body.payload.estado).toBe("CANCELADA");
    expect(res.body.payload.cancelacion).toMatchObject({ tipo: "RESIDENTE", canceladaPorUserId: 4011, motivo: null });
    expect(await ocupadosDe(zonaId)).toBe(0);

    const disponibilidad = await request(app)
      .get(`/api/v1/zonas-comunes/${zonaId}/disponibilidad?desde=${fecha}&hasta=${fecha}`)
      .set("Cookie", residente(4021).cookie);
    const franja = disponibilidad.body.payload.dias[0].franjas.find((item: { horaInicio: string }) => item.horaInicio === "10:00");
    expect(franja).toMatchObject({ estado: "DISPONIBLE", cuposRestantes: 1 });
    expect((await reservar(4021, zonaId, fecha, "10:00")).status).toBe(201);
  });

  it("CA-3 rechaza cancelar cuando ya paso la anticipacion minima de cancelacion", async () => {
    const zonaId = await crearZona({ anticipacionCancelacionHoras: 48 });
    const creada = await reservar(4031, zonaId, fechaEn(1), "18:00");

    const res = await cancelar(4031, creada.body.payload.id);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ANTICIPACION_CANCELACION");
    expect(res.body.error.details).toEqual({ anticipacionCancelacionHoras: 48 });
  });

  it("CA-4 rechaza con 403 cancelar la reserva de otro apartamento", async () => {
    const zonaId = await crearZona();
    const creada = await reservar(4041, zonaId, fechaEn(5), "08:00");

    const res = await cancelar(4051, creada.body.payload.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("RESERVA_AJENA");
  });

  it("CA-5 rechaza cancelar una reserva pasada", async () => {
    const zonaId = await crearZona();
    const reservaId = await insertarReservaConfirmada(zonaId, enDias(-2, "08:00"), enDias(-2, "10:00"), apartamentoIdDe(4061));

    const res = await cancelar(4061, reservaId);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RESERVA_PASADA");
  });

  it("CA-6 cancelar dos veces es idempotente y no libera el cupo dos veces", async () => {
    const zonaId = await crearZona({ aforo: 3 });
    const fecha = fechaEn(5);
    await reservar(4071, zonaId, fecha, "08:00");
    const creada = await reservar(4081, zonaId, fecha, "08:00");

    const primera = await cancelar(4081, creada.body.payload.id);
    const segunda = await cancelar(4081, creada.body.payload.id);

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(segunda.body.payload.cancelacion.canceladaEn).toBe(primera.body.payload.cancelacion.canceladaEn);
    expect(await ocupadosDe(zonaId)).toBe(1);
  });

  it("un arrendatario del mismo apartamento puede cancelar una reserva creada por el propietario", async () => {
    const zonaId = await crearZona();
    const creada = await reservar(4091, zonaId, fechaEn(5), "12:00");

    const res = await cancelar(4099, creada.body.payload.id);

    expect(res.status).toBe(200);
  });

  it("responde 404 para una reserva inexistente", async () => {
    const res = await cancelar(4101, 999999);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RESERVA_NO_ENCONTRADA");
  });
});
