import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import Calendario from "../../src/lib/calendario";
import server from "../../src/server";
import { insertarReservaConfirmada, zonaPayload } from "./support/datos";
import { administrador, residente } from "./support/session";

const app = server.httpServer;
const admin = administrador();
const vecino = residente(10);

interface FranjaRespuesta {
  horaInicio: string;
  estado: string;
  cuposRestantes: number;
  motivoBloqueo: string | null;
}

async function crearZona(overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await request(app)
    .post("/api/v1/zonas-comunes")
    .set("Cookie", admin.cookie)
    .set("X-XSRF-TOKEN", admin.csrf)
    .send(zonaPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.payload.id;
}

function fechaEn(dias: number): string {
  return Calendario.sumarDias(Calendario.fechaLocal(new Date()), dias);
}

async function consultar(zonaId: number, desde: string, hasta: string) {
  return request(app).get(`/api/v1/zonas-comunes/${zonaId}/disponibilidad?desde=${desde}&hasta=${hasta}`).set("Cookie", vecino.cookie);
}

async function franjasDe(zonaId: number, fecha: string): Promise<FranjaRespuesta[]> {
  const res = await consultar(zonaId, fecha, fecha);
  expect(res.status).toBe(200);
  return res.body.payload.dias[0].franjas;
}

describe("HU-3.2 consultar el calendario de disponibilidad de una zona", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 una zona de 08:00 a 20:00 con franjas de 120 minutos tiene 6 franjas por dia", async () => {
    const zonaId = await crearZona({ horaApertura: "08:00", horaCierre: "20:00", duracionFranjaMinutos: 120 });

    const franjas = await franjasDe(zonaId, fechaEn(3));

    expect(franjas.map((franja) => franja.horaInicio)).toEqual(["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]);
    expect(franjas.every((franja) => franja.estado === "DISPONIBLE")).toBe(true);
  });

  it("CA-2 una franja de aforo 3 con 2 reservas aparece parcialmente ocupada con 1 cupo restante", async () => {
    const zonaId = await crearZona({ aforo: 3 });
    const fecha = fechaEn(4);
    const inicio = Calendario.instante(fecha, "10:00");
    const fin = Calendario.instante(fecha, "12:00");
    await insertarReservaConfirmada(zonaId, inicio, fin, 201, 3);
    await insertarReservaConfirmada(zonaId, inicio, fin, 202, 3);

    const franja = (await franjasDe(zonaId, fecha)).find((item) => item.horaInicio === "10:00");

    expect(franja).toMatchObject({ estado: "PARCIAL", cuposRestantes: 1 });
  });

  it("CA-3 una franja con el aforo agotado aparece completa", async () => {
    const zonaId = await crearZona({ aforo: 1 });
    const fecha = fechaEn(4);
    await insertarReservaConfirmada(zonaId, Calendario.instante(fecha, "08:00"), Calendario.instante(fecha, "10:00"), 203);

    const franja = (await franjasDe(zonaId, fecha)).find((item) => item.horaInicio === "08:00");

    expect(franja).toMatchObject({ estado: "COMPLETA", cuposRestantes: 0 });
  });

  it("CA-4 una franja dentro de un bloqueo por mantenimiento aparece bloqueada con el motivo", async () => {
    const zonaId = await crearZona();
    const fecha = fechaEn(5);
    await knex("bloqueos_mantenimiento").insert({
      zona_id: zonaId,
      inicio: Calendario.instante(fecha, "12:00"),
      fin: Calendario.instante(fecha, "16:00"),
      motivo: "Mantenimiento de la cubierta",
      creado_por_user_id: 900,
    });

    const franjas = await franjasDe(zonaId, fecha);

    expect(franjas.filter((franja) => franja.estado === "BLOQUEADA").map((franja) => franja.horaInicio)).toEqual(["12:00", "14:00"]);
    expect(franjas.find((franja) => franja.horaInicio === "12:00")?.motivoBloqueo).toBe("Mantenimiento de la cubierta");
  });

  it("CA-5 con anticipacion minima de 24 horas las franjas de hoy no estan disponibles", async () => {
    const zonaId = await crearZona({ anticipacionMinimaHoras: 24, horaApertura: "00:00", horaCierre: "23:00", duracionFranjaMinutos: 60 });

    const franjas = await franjasDe(zonaId, fechaEn(0));

    expect(franjas.every((franja) => franja.estado === "FUERA_DE_ANTICIPACION")).toBe(true);
  });

  it("CA-6 rechaza un rango de mas de 60 dias", async () => {
    const zonaId = await crearZona();

    const res = await consultar(zonaId, fechaEn(0), fechaEn(60));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RANGO_DEMASIADO_AMPLIO");
    expect((await consultar(zonaId, fechaEn(0), fechaEn(59))).status).toBe(200);
  });

  it("sin rango devuelve los proximos 7 dias", async () => {
    const zonaId = await crearZona();

    const res = await request(app).get(`/api/v1/zonas-comunes/${zonaId}/disponibilidad`).set("Cookie", vecino.cookie);

    expect(res.body.payload.dias).toHaveLength(7);
    expect(res.body.payload.desde).toBe(fechaEn(0));
  });
});
