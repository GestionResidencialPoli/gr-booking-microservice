import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import Calendario from "../../src/lib/calendario";
import server from "../../src/server";
import { crearZona, fechaEn, reservar } from "./support/reservas";
import { vigilante } from "./support/session";
import { UID_APARTAMENTO_INACTIVO, UID_SIN_APARTAMENTO, apartamentoIdDe } from "./support/user-service-stub";

const app = server.httpServer;

async function reservasConfirmadas(zonaId: number): Promise<number> {
  const [fila] = await knex("reservas").where({ zona_id: zonaId, estado: "CONFIRMADA" }).count<{ count: string }[]>({ count: "*" });
  return Number(fila?.count ?? 0);
}

describe("HU-3.3 reservar una zona comun sin cruces y estando a paz y salvo", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 un residente a paz y salvo reserva una franja con cupo y recibe el detalle", async () => {
    const zonaId = await crearZona();
    const fecha = fechaEn(3);

    const res = await reservar(1011, zonaId, fecha, "10:00");

    expect(res.status).toBe(201);
    expect(res.body.payload).toMatchObject({
      zona: { id: zonaId },
      apartamento: { id: apartamentoIdDe(1011), torre: "T", numero: String(apartamentoIdDe(1011)) },
      residente: { userId: 1011, nombre: "Residente 1011" },
      fecha,
      horaInicio: "10:00",
      horaFin: "12:00",
      estado: "CONFIRMADA",
      cancelacion: null,
    });
  });

  it("CA-2 una franja con el aforo agotado responde 409 explicando que ya no esta disponible", async () => {
    const zonaId = await crearZona({ aforo: 1 });
    const fecha = fechaEn(3);
    await reservar(1021, zonaId, fecha, "08:00");

    const res = await reservar(1031, zonaId, fecha, "08:00");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("FRANJA_SIN_CUPO");
    expect(res.body.error.message).toMatch(/acaba de ser tomada/);
  });

  it("CA-3 un apartamento con saldo vencido recibe 422 y no se crea la reserva", async () => {
    const zonaId = await crearZona();
    await knex("estado_cartera").insert({ apartamento_id: apartamentoIdDe(1041), saldo_vencido: 350000, fuente_actualizada_en: new Date() });

    const res = await reservar(1041, zonaId, fechaEn(3), "08:00");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SIN_PAZ_Y_SALVO");
    expect(await reservasConfirmadas(zonaId)).toBe(0);
  });

  it("CA-4 un apartamento con 2 reservas futuras activas recibe 422 en la tercera", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const fecha = fechaEn(3);
    expect((await reservar(1051, zonaId, fecha, "08:00")).status).toBe(201);
    expect((await reservar(1052, zonaId, fecha, "10:00")).status).toBe(201);

    const res = await reservar(1053, zonaId, fecha, "12:00");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("LIMITE_RESERVAS_ACTIVAS");
  });

  it("CA-5 dos residentes que piden la misma franja de aforo 1 a la vez: exactamente una se confirma y la otra recibe 409", async () => {
    const zonaId = await crearZona({ aforo: 1 });
    const fecha = fechaEn(4);

    const respuestas = await Promise.all([reservar(1061, zonaId, fecha, "14:00"), reservar(1071, zonaId, fecha, "14:00")]);

    expect(respuestas.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await reservasConfirmadas(zonaId)).toBe(1);
  });

  it("CA-6 20 residentes compiten a la vez por una franja de aforo 5: se confirman exactamente 5 y se rechazan 15 con 409", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const fecha = fechaEn(4);

    const respuestas = await Promise.all(Array.from({ length: 20 }, (_, i) => reservar(2000 + i * 10, zonaId, fecha, "16:00")));
    const estados = respuestas.map((res) => res.status);

    expect(estados.filter((estado) => estado === 201)).toHaveLength(5);
    expect(estados.filter((estado) => estado === 409)).toHaveLength(15);
    expect(await reservasConfirmadas(zonaId)).toBe(5);
    const franja = await knex("franjas_ocupacion").where({ zona_id: zonaId }).first();
    expect(franja.ocupados).toBe(5);
  });

  it("CA-7 una reserva rechazada no deja ningun registro parcial", async () => {
    const zonaId = await crearZona({ aforo: 1 });
    const fecha = fechaEn(3);
    await reservar(1081, zonaId, fecha, "08:00");

    await reservar(1091, zonaId, fecha, "08:00");
    await knex("estado_cartera").insert({ apartamento_id: apartamentoIdDe(1101), saldo_vencido: 1, fuente_actualizada_en: new Date() });
    await reservar(1101, zonaId, fecha, "12:00");

    expect(await knex("reservas").where({ zona_id: zonaId }).count<{ count: string }[]>({ count: "*" })).toEqual([{ count: "1" }]);
    const franjas = await knex("franjas_ocupacion").where({ zona_id: zonaId }).select("ocupados");
    expect(franjas).toEqual([{ ocupados: 1 }]);
  });

  it("CA-8 una zona desactivada responde 422", async () => {
    const zonaId = await crearZona();
    await knex("zonas_comunes").where({ id: zonaId }).update({ activa: false });

    const res = await reservar(1111, zonaId, fechaEn(3), "08:00");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ZONA_INACTIVA");
  });

  it("HU-3.1 CA-4 con aforo 3 tres apartamentos distintos se confirman y el cuarto se rechaza", async () => {
    const zonaId = await crearZona({ aforo: 3 });
    const fecha = fechaEn(5);

    const estados = [];
    for (const uid of [1121, 1131, 1141, 1151]) estados.push((await reservar(uid, zonaId, fecha, "10:00")).status);

    expect(estados).toEqual([201, 201, 201, 409]);
  });

  it("HU-3.1 CA-7 con anticipacion minima de 24 horas rechaza reservar para dentro de 2 horas indicando la regla", async () => {
    const zonaId = await crearZona({
      anticipacionMinimaHoras: 24,
      horaApertura: "00:00",
      horaCierre: "23:59",
      duracionFranjaMinutos: 60,
      confirmarFranjaIncompleta: true,
    });
    const dentroDeDosHoras = new Date(Date.now() + 2 * 3_600_000);
    const hora = `${Calendario.horaLocal(dentroDeDosHoras).slice(0, 2)}:00`;

    const res = await reservar(1161, zonaId, Calendario.fechaLocal(dentroDeDosHoras), hora);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ANTICIPACION_MINIMA");
    expect(res.body.error.details).toEqual({ anticipacionMinimaHoras: 24 });
  });

  it("rechaza una hora que no es inicio de franja, un usuario sin apartamento o con apartamento inactivo", async () => {
    const zonaId = await crearZona();
    const fecha = fechaEn(3);

    expect((await reservar(1171, zonaId, fecha, "09:00")).body.error.code).toBe("FRANJA_INVALIDA");
    expect((await reservar(UID_SIN_APARTAMENTO, zonaId, fecha, "08:00")).body.error.code).toBe("SIN_APARTAMENTO");
    expect((await reservar(UID_APARTAMENTO_INACTIVO, zonaId, fecha, "08:00")).body.error.code).toBe("APARTAMENTO_INACTIVO");
  });

  it("solo un residente puede reservar", async () => {
    const zonaId = await crearZona();
    const guardia = vigilante();

    const res = await request(app)
      .post("/api/v1/reservas")
      .set("Cookie", guardia.cookie)
      .set("X-XSRF-TOKEN", guardia.csrf)
      .send({ zonaId, fecha: fechaEn(3), horaInicio: "08:00" });

    expect(res.status).toBe(403);
  });
});
