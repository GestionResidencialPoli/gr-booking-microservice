import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import server from "../../src/server";
import { crearZona, fechaEn, reservar } from "./support/reservas";
import { administrador, residente } from "./support/session";

const app = server.httpServer;
const admin = administrador(970);

function bloquear(zonaId: number, body: Record<string, unknown>, session = admin) {
  return request(app).post(`/api/v1/zonas-comunes/${zonaId}/bloqueos`).set("Cookie", session.cookie).set("X-XSRF-TOKEN", session.csrf).send(body);
}

async function franjasDe(zonaId: number, fecha: string) {
  const res = await request(app)
    .get(`/api/v1/zonas-comunes/${zonaId}/disponibilidad?desde=${fecha}&hasta=${fecha}`)
    .set("Cookie", residente(7999).cookie);
  return res.body.payload.dias[0].franjas as Array<{ horaInicio: string; estado: string; motivoBloqueo: string | null }>;
}

describe("HU-3.7 bloquear una zona por mantenimiento", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 y CA-4 ninguna franja del rango admite reservas y el calendario las muestra bloqueadas con el motivo", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const res = await bloquear(zonaId, { inicio: `${fechaEn(10)}T00:00`, fin: `${fechaEn(16)}T00:00`, motivo: "Mantenimiento de la piscina" });

    expect(res.status).toBe(201);
    const intento = await reservar(7011, zonaId, fechaEn(12), "10:00");
    expect(intento.status).toBe(422);
    expect(intento.body.error.code).toBe("FRANJA_BLOQUEADA");

    const franjas = await franjasDe(zonaId, fechaEn(12));
    expect(franjas.every((franja) => franja.estado === "BLOQUEADA" && franja.motivoBloqueo === "Mantenimiento de la piscina")).toBe(true);
    expect((await franjasDe(zonaId, fechaEn(16))).every((franja) => franja.estado !== "BLOQUEADA")).toBe(true);
  });

  it("CA-2 lista las reservas confirmadas afectadas antes de confirmar el bloqueo", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const afectada = await reservar(7021, zonaId, fechaEn(6), "10:00");
    await reservar(7031, zonaId, fechaEn(8), "10:00");
    const rango = { inicio: `${fechaEn(6)}T00:00`, fin: `${fechaEn(7)}T00:00` };

    const vista = await request(app)
      .get(`/api/v1/zonas-comunes/${zonaId}/bloqueos/reservas-afectadas?inicio=${rango.inicio}&fin=${rango.fin}`)
      .set("Cookie", admin.cookie);
    const sinConfirmar = await bloquear(zonaId, { ...rango, motivo: "Fumigacion" });

    expect(vista.body.payload.map((reserva: { id: number }) => reserva.id)).toEqual([afectada.body.payload.id]);
    expect(sinConfirmar.status).toBe(409);
    expect(sinConfirmar.body.error.code).toBe("RESERVAS_AFECTADAS");
    expect(sinConfirmar.body.error.details.reservas.map((reserva: { id: number }) => reserva.id)).toEqual([afectada.body.payload.id]);
    expect(await knex("bloqueos_mantenimiento").where({ zona_id: zonaId })).toHaveLength(0);
  });

  it("CA-3 al confirmar cancela en bloque las reservas afectadas con el motivo del mantenimiento y libera sus cupos", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const primera = await reservar(7041, zonaId, fechaEn(6), "08:00");
    const segunda = await reservar(7051, zonaId, fechaEn(6), "12:00");
    const fuera = await reservar(7061, zonaId, fechaEn(9), "12:00");

    const res = await bloquear(zonaId, {
      inicio: `${fechaEn(6)}T00:00`,
      fin: `${fechaEn(7)}T00:00`,
      motivo: "Cambio de filtros",
      cancelarReservasAfectadas: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.payload.reservasCanceladas.map((reserva: { id: number }) => reserva.id).sort()).toEqual(
      [primera.body.payload.id, segunda.body.payload.id].sort(),
    );
    expect(res.body.payload.reservasCanceladas[0].cancelacion).toMatchObject({
      tipo: "MANTENIMIENTO",
      canceladaPorUserId: 970,
      motivo: "Mantenimiento: Cambio de filtros",
    });
    const intacta = await knex("reservas").where({ id: fuera.body.payload.id }).first();
    expect(intacta.estado).toBe("CONFIRMADA");
    const ocupadas = await knex("franjas_ocupacion").where({ zona_id: zonaId }).andWhere("ocupados", ">", 0);
    expect(ocupadas).toHaveLength(1);
  });

  it("CA-5 eliminar el bloqueo libera las franjas pero no restablece las reservas canceladas", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const cancelada = await reservar(7071, zonaId, fechaEn(6), "10:00");
    const creado = await bloquear(zonaId, {
      inicio: `${fechaEn(6)}T00:00`,
      fin: `${fechaEn(7)}T00:00`,
      motivo: "Pintura",
      cancelarReservasAfectadas: true,
    });

    const res = await request(app)
      .delete(`/api/v1/zonas-comunes/${zonaId}/bloqueos/${creado.body.payload.bloqueo.id}`)
      .set("Cookie", admin.cookie)
      .set("X-XSRF-TOKEN", admin.csrf);

    expect(res.status).toBe(204);
    expect((await franjasDe(zonaId, fechaEn(6))).every((franja) => franja.estado === "DISPONIBLE")).toBe(true);
    const reserva = await knex("reservas").where({ id: cancelada.body.payload.id }).first();
    expect(reserva.estado).toBe("CANCELADA");
  });

  it("CA-6 rechaza un bloqueo con fin anterior al inicio", async () => {
    const zonaId = await crearZona();

    const res = await bloquear(zonaId, { inicio: `${fechaEn(10)}T00:00`, fin: `${fechaEn(9)}T00:00`, motivo: "Invalido" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RANGO_INVALIDO");
  });

  it("un residente no puede bloquear una zona", async () => {
    const zonaId = await crearZona();
    const res = await bloquear(zonaId, { inicio: `${fechaEn(10)}T00:00`, fin: `${fechaEn(11)}T00:00`, motivo: "No" }, residente(7081));
    expect(res.status).toBe(403);
  });
});
