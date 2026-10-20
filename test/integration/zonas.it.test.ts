import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import server from "../../src/server";
import { enDias, insertarReservaConfirmada, zonaPayload } from "./support/datos";
import { administrador, residente, type TestSession } from "./support/session";

const app = server.httpServer;
const admin = administrador();

function crear(session: TestSession, body: Record<string, unknown>) {
  return request(app).post("/api/v1/zonas-comunes").set("Cookie", session.cookie).set("X-XSRF-TOKEN", session.csrf).send(body);
}

async function crearZona(overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await crear(admin, zonaPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.payload.id;
}

describe("HU-3.1 configurar zonas comunes, horarios y aforo", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 crea el Salon Social con franjas de 240 minutos y aforo 1 tras confirmar la franja incompleta", async () => {
    const payload = zonaPayload({ horaApertura: "08:00", horaCierre: "22:00", duracionFranjaMinutos: 240 });

    const advertencia = await crear(admin, payload);
    expect(advertencia.status).toBe(422);
    expect(advertencia.body.error.code).toBe("FRANJA_INCOMPLETA");
    expect(advertencia.body.error.details).toEqual({ minutosUltimaFranja: 120, franjasPorDia: 4 });

    const res = await crear(admin, { ...payload, confirmarFranjaIncompleta: true });
    expect(res.status).toBe(201);
    expect(res.body.payload).toMatchObject({
      horaApertura: "08:00",
      horaCierre: "22:00",
      duracionFranjaMinutos: 240,
      aforo: 1,
      activa: true,
      franjasPorDia: 4,
      ultimaFranjaIncompleta: true,
    });
  });

  it("CA-2 rechaza una hora de cierre anterior a la de apertura", async () => {
    const res = await crear(admin, zonaPayload({ horaApertura: "20:00", horaCierre: "08:00" }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("HORARIO_INVALIDO");
  });

  it("CA-3 crea sin advertencia cuando la duracion cabe un numero entero de veces", async () => {
    const res = await crear(admin, zonaPayload({ horaApertura: "08:00", horaCierre: "20:00", duracionFranjaMinutos: 120 }));
    expect(res.status).toBe(201);
    expect(res.body.payload.franjasPorDia).toBe(6);
    expect(res.body.payload.ultimaFranjaIncompleta).toBe(false);
  });

  it("CA-5 al desactivar una zona conserva y lista las reservas futuras, y ya no aparece a los residentes", async () => {
    const zonaId = await crearZona();
    const reservaId = await insertarReservaConfirmada(zonaId, enDias(5, "08:00"), enDias(5, "10:00"), 101);

    const res = await request(app)
      .patch(`/api/v1/zonas-comunes/${zonaId}/activacion`)
      .set("Cookie", admin.cookie)
      .set("X-XSRF-TOKEN", admin.csrf)
      .send({ activa: false });

    expect(res.status).toBe(200);
    expect(res.body.payload.zona.activa).toBe(false);
    expect(res.body.payload.reservasFuturas.map((reserva: { id: number }) => reserva.id)).toEqual([reservaId]);

    const vistaResidente = await request(app).get(`/api/v1/zonas-comunes/${zonaId}`).set("Cookie", residente(1).cookie);
    expect(vistaResidente.status).toBe(404);

    const listadoResidente = await request(app).get("/api/v1/zonas-comunes").set("Cookie", residente(1).cookie);
    expect(listadoResidente.body.payload.map((zona: { id: number }) => zona.id)).not.toContain(zonaId);
  });

  it("CA-6 un residente recibe 403 al crear o editar una zona", async () => {
    const zonaId = await crearZona();
    const vecino = residente(2);

    expect((await crear(vecino, zonaPayload())).status).toBe(403);
    const edicion = await request(app)
      .put(`/api/v1/zonas-comunes/${zonaId}`)
      .set("Cookie", vecino.cookie)
      .set("X-XSRF-TOKEN", vecino.csrf)
      .send(zonaPayload());
    expect(edicion.status).toBe(403);
  });

  it("rechaza nombres duplicados sin importar mayusculas", async () => {
    const payload = zonaPayload();
    await crearZona({ nombre: payload.nombre });

    const res = await crear(admin, { ...payload, nombre: payload.nombre.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ZONA_DUPLICADA");
  });

  it("no permite cambiar el horario mientras haya reservas futuras, pero si el aforo", async () => {
    const zonaId = await crearZona({ aforo: 3 });
    await insertarReservaConfirmada(zonaId, enDias(3, "08:00"), enDias(3, "10:00"), 102, 3);
    const actualizar = (body: Record<string, unknown>) =>
      request(app).put(`/api/v1/zonas-comunes/${zonaId}`).set("Cookie", admin.cookie).set("X-XSRF-TOKEN", admin.csrf).send(body);

    const horario = await actualizar(zonaPayload({ horaApertura: "09:00", horaCierre: "21:00", aforo: 3 }));
    expect(horario.status).toBe(409);
    expect(horario.body.error.code).toBe("ZONA_CON_RESERVAS_FUTURAS");

    const aforo = await actualizar(zonaPayload({ aforo: 4 }));
    expect(aforo.status).toBe(200);
    const franja = await knex("franjas_ocupacion").where({ zona_id: zonaId }).first();
    expect(franja.aforo).toBe(4);
  });

  it("rechaza reducir el aforo por debajo de las reservas ya confirmadas en una franja futura", async () => {
    const zonaId = await crearZona({ aforo: 3 });
    await insertarReservaConfirmada(zonaId, enDias(4, "08:00"), enDias(4, "10:00"), 103, 3);
    await insertarReservaConfirmada(zonaId, enDias(4, "08:00"), enDias(4, "10:00"), 104, 3);

    const res = await request(app)
      .put(`/api/v1/zonas-comunes/${zonaId}`)
      .set("Cookie", admin.cookie)
      .set("X-XSRF-TOKEN", admin.csrf)
      .send(zonaPayload({ aforo: 1 }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("AFORO_MENOR_QUE_OCUPACION");
  });

  it("valida el cuerpo de la solicitud en el borde", async () => {
    const res = await crear(admin, zonaPayload({ horaApertura: "8am", aforo: 0 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SOLICITUD_INVALIDA");
  });
});
