import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import server from "../../src/server";
import { crearZona, fechaEn, reservar } from "./support/reservas";
import { administrador, residente } from "./support/session";

const app = server.httpServer;
const admin = administrador(950);

function cancelarComoAdmin(reservaId: number, body: Record<string, unknown>) {
  return request(app)
    .patch(`/api/v1/reservas/${reservaId}/cancelacion-administrativa`)
    .set("Cookie", admin.cookie)
    .set("X-XSRF-TOKEN", admin.csrf)
    .send(body);
}

describe("HU-3.6 supervisar y cancelar reservas como administrador", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1 y CA-2 lista las reservas de todos los apartamentos y filtra por zona y rango de fechas", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const otraZonaId = await crearZona({ aforo: 5 });
    const dentro = await reservar(6011, zonaId, fechaEn(3), "08:00");
    const otroApartamento = await reservar(6021, zonaId, fechaEn(4), "08:00");
    await reservar(6031, zonaId, fechaEn(20), "08:00");
    await reservar(6041, otraZonaId, fechaEn(3), "08:00");

    const res = await request(app)
      .get(`/api/v1/reservas?zonaId=${zonaId}&desde=${fechaEn(3)}&hasta=${fechaEn(4)}`)
      .set("Cookie", admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.payload.totalElements).toBe(2);
    expect(res.body.payload.content.map((reserva: { id: number }) => reserva.id).sort()).toEqual(
      [dentro.body.payload.id, otroApartamento.body.payload.id].sort(),
    );
  });

  it("CA-3 cancela cualquier reserva sin sujetarse a la anticipacion de cancelacion del residente", async () => {
    const zonaId = await crearZona({ anticipacionCancelacionHoras: 72 });
    const creada = await reservar(6051, zonaId, fechaEn(1), "18:00");

    const res = await cancelarComoAdmin(creada.body.payload.id, { motivo: "Dano en la zona" });

    expect(res.status).toBe(200);
    expect(res.body.payload.estado).toBe("CANCELADA");
  });

  it("CA-4 rechaza la cancelacion administrativa sin motivo", async () => {
    const zonaId = await crearZona();
    const creada = await reservar(6061, zonaId, fechaEn(3), "08:00");

    expect((await cancelarComoAdmin(creada.body.payload.id, {})).status).toBe(400);
    expect((await cancelarComoAdmin(creada.body.payload.id, { motivo: "  " })).status).toBe(400);
  });

  it("CA-5 deja constancia del administrador que cancelo y del motivo", async () => {
    const zonaId = await crearZona();
    const creada = await reservar(6071, zonaId, fechaEn(3), "10:00");

    const res = await cancelarComoAdmin(creada.body.payload.id, { motivo: "Incumplimiento del reglamento" });

    expect(res.body.payload.cancelacion).toMatchObject({
      tipo: "ADMINISTRACION",
      canceladaPorUserId: 950,
      motivo: "Incumplimiento del reglamento",
    });
    const fila = await knex("reservas").where({ id: creada.body.payload.id }).first();
    expect(fila).toMatchObject({ cancelada_por_user_id: "950", cancelacion_motivo: "Incumplimiento del reglamento" });
  });

  it("CA-6 un residente recibe 403 al acceder al listado global o cancelar como administrador", async () => {
    const vecino = residente(6081);

    expect((await request(app).get("/api/v1/reservas").set("Cookie", vecino.cookie)).status).toBe(403);
    const res = await request(app)
      .patch("/api/v1/reservas/1/cancelacion-administrativa")
      .set("Cookie", vecino.cookie)
      .set("X-XSRF-TOKEN", vecino.csrf)
      .send({ motivo: "No deberia poder" });
    expect(res.status).toBe(403);
  });
});
