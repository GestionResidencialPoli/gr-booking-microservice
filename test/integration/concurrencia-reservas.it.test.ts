import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import Calendario from "../../src/lib/calendario";
import server from "../../src/server";
import { contar, lanzarALaVez, registrarMedicion } from "./support/carga-concurrente";
import {
  bloqueoPesimistaDeZona,
  contadorAtomico,
  mutexEnProceso,
  restriccionDeExclusion,
  sinMecanismo,
  type Estrategia,
  type Solicitud,
} from "./support/estrategias-reserva";
import { levantarReplica } from "./support/replicas";
import { crearZona, fechaEn } from "./support/reservas";
import { residente } from "./support/session";

const app = server.httpServer;
const HILOS = 50;
let uidBase = 100_000;

function uidsNuevos(cantidad: number): number[] {
  const inicio = uidBase;
  uidBase += cantidad * 10;
  return Array.from({ length: cantidad }, (_, i) => inicio + i * 10);
}

function solicitud(zonaId: number, aforo: number, apartamentoId: number, fecha = fechaEn(5), horaInicio = "10:00"): Solicitud {
  const inicio = Calendario.instante(fecha, horaInicio);
  return { zonaId, aforo, fecha, horaInicio, inicio, fin: new Date(inicio.getTime() + 120 * 60_000), apartamentoId };
}

async function confirmadasEnZona(zonaId: number): Promise<number> {
  const [fila] = await knex("reservas").where({ zona_id: zonaId, estado: "CONFIRMADA" }).count<{ count: string }[]>({ count: "*" });
  return Number(fila?.count ?? 0);
}

async function competir(estrategia: Estrategia | Estrategia[], aforo: number, escenario: string) {
  const zonaId = await crearZona({ aforo });
  const estrategias = Array.isArray(estrategia) ? estrategia : [estrategia];
  const apartamentos = uidsNuevos(HILOS).map((uid) => uid / 10);

  const medicion = await lanzarALaVez(HILOS, (i) =>
    estrategias[i % estrategias.length]!(solicitud(zonaId, aforo, apartamentos[i]!)),
  );
  const confirmadas = await confirmadasEnZona(zonaId);
  registrarMedicion(escenario, medicion, { aforo, hilos: HILOS, confirmadasEnBase: confirmadas });
  return { confirmadas, resultados: medicion.resultados };
}

function reservarHttp(uid: number, zonaId: number, fecha: string, horaInicio: string) {
  const session = residente(uid);
  return request(app)
    .post("/api/v1/reservas")
    .set("Cookie", session.cookie)
    .set("X-XSRF-TOKEN", session.csrf)
    .send({ zonaId, fecha, horaInicio });
}

describe("QA-3.1 / HU-3.8 ausencia de doble reserva bajo acceso concurrente", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("CA-1, CA-2 y CA-6 con aforo 1 y 50 solicitudes simultaneas: una 201, 49 con 409, ninguna 500 y una sola fila confirmada", async () => {
    const zonaId = await crearZona({ aforo: 1 });
    const uids = uidsNuevos(HILOS);
    const fecha = fechaEn(5);

    const medicion = await lanzarALaVez(HILOS, (i) => reservarHttp(uids[i]!, zonaId, fecha, "10:00"));
    const estados = medicion.resultados.map((res) => res.status);
    registrarMedicion("http-contador-atomico-aforo-1", medicion, { hilos: HILOS });

    expect(contar(estados, 201)).toBe(1);
    expect(contar(estados, 409)).toBe(49);
    expect(contar(estados, 500)).toBe(0);
    expect(await confirmadasEnZona(zonaId)).toBe(1);
    const rechazo = medicion.resultados.find((res) => res.status === 409);
    expect(rechazo?.body.error.message).toMatch(/acaba de ser tomada.*Elige otra franja/);
  });

  it("CA-3 con aforo 5 y 50 solicitudes simultaneas se confirman exactamente 5", async () => {
    const zonaId = await crearZona({ aforo: 5 });
    const uids = uidsNuevos(HILOS);
    const fecha = fechaEn(5);

    const medicion = await lanzarALaVez(HILOS, (i) => reservarHttp(uids[i]!, zonaId, fecha, "10:00"));
    registrarMedicion("http-contador-atomico-aforo-5", medicion, { hilos: HILOS });

    expect(contar(medicion.resultados.map((res) => res.status), 201)).toBe(5);
    expect(await confirmadasEnZona(zonaId)).toBe(5);
    const franja = await knex("franjas_ocupacion").where({ zona_id: zonaId }).first();
    expect(franja.ocupados).toBe(5);
  });

  it("CA-5 100 solicitudes simultaneas sobre franjas distintas se confirman todas y no se serializan", async () => {
    const zonaId = await crearZona({ aforo: 1, horaApertura: "00:00", horaCierre: "20:00", duracionFranjaMinutos: 60 });
    const franjas = Array.from({ length: 120 }, (_, i) => ({ fecha: fechaEn(5 + Math.floor(i / 20)), hora: `${String(i % 20).padStart(2, "0")}:00` }));
    const uids = uidsNuevos(120);

    const inicioSecuencial = performance.now();
    for (let i = 100; i < 120; i += 1) {
      expect((await reservarHttp(uids[i]!, zonaId, franjas[i]!.fecha, franjas[i]!.hora)).status).toBe(201);
    }
    const costoSecuencialPorSolicitud = (performance.now() - inicioSecuencial) / 20;

    const medicion = await lanzarALaVez(100, (i) => reservarHttp(uids[i]!, zonaId, franjas[i]!.fecha, franjas[i]!.hora));
    registrarMedicion("http-contador-atomico-franjas-distintas", medicion, { hilos: 100, costoSecuencialPorSolicitud });

    expect(medicion.resultados.every((res) => res.status === 201)).toBe(true);
    expect(await confirmadasEnZona(zonaId)).toBe(120);
    expect(medicion.duracionTotalMs).toBeLessThan(costoSecuencialPorSolicitud * 100 * 0.5);
  });

  it("QA-3.1 CA-5 la prueba es determinista: 20 ejecuciones seguidas dan exactamente una reserva", async () => {
    const confirmadasPorEjecucion = [];
    for (let ejecucion = 0; ejecucion < 20; ejecucion += 1) {
      confirmadasPorEjecucion.push((await competir(contadorAtomico, 1, "determinismo")).confirmadas);
    }
    expect(confirmadasPorEjecucion).toEqual(Array(20).fill(1));
  });

  it("CA-4 al retirar el mecanismo aparece la doble reserva: consultar y luego insertar sobre-reserva", async () => {
    const aforoUno = await competir(sinMecanismo, 1, "sin-mecanismo-aforo-1");
    const aforoCinco = await competir(sinMecanismo, 5, "sin-mecanismo-aforo-5");

    expect(aforoUno.confirmadas).toBeGreaterThan(1);
    expect(aforoCinco.confirmadas).toBeGreaterThan(5);
  });

  it("un mutex en memoria del proceso es correcto con una replica pero falla con dos", async () => {
    const unaReplica = await competir(mutexEnProceso(), 1, "mutex-en-proceso-1-replica");
    const dosReplicas = await competir([mutexEnProceso(), mutexEnProceso()], 1, "mutex-en-proceso-2-replicas");

    expect(unaReplica.confirmadas).toBe(1);
    expect(dosReplicas.confirmadas).toBeGreaterThan(1);
  });

  it("el bloqueo pesimista de la zona y la restriccion de exclusion tambien son correctos entre replicas", async () => {
    const pesimistaUno = await competir(bloqueoPesimistaDeZona, 1, "bloqueo-pesimista-aforo-1");
    const pesimistaCinco = await competir(bloqueoPesimistaDeZona, 5, "bloqueo-pesimista-aforo-5");
    const exclusion = await competir(restriccionDeExclusion, 1, "restriccion-exclusion-aforo-1");
    const contador = await competir(contadorAtomico, 5, "contador-atomico-aforo-5");

    expect(pesimistaUno.confirmadas).toBe(1);
    expect(pesimistaCinco.confirmadas).toBe(5);
    expect(exclusion.confirmadas).toBe(1);
    expect(contador.confirmadas).toBe(5);
  }, 180_000);

  it("CA-7 contra dos replicas reales del servicio (dos procesos, misma base) se confirma exactamente una reserva", async () => {
    const replicas = await Promise.all([levantarReplica(4291), levantarReplica(4292)]);
    try {
      const zonaId = await crearZona({ aforo: 1 });
      const uids = uidsNuevos(HILOS);
      const fecha = fechaEn(6);

      const medicion = await lanzarALaVez(HILOS, (i) => {
        const session = residente(uids[i]!);
        return fetch(`${replicas[i % 2]!.url}/api/v1/reservas`, {
          method: "POST",
          headers: { Cookie: session.cookie, "X-XSRF-TOKEN": session.csrf, "Content-Type": "application/json" },
          body: JSON.stringify({ zonaId, fecha, horaInicio: "10:00" }),
        }).then((res) => res.status);
      });
      registrarMedicion("http-contador-atomico-2-replicas", medicion, { hilos: HILOS });

      expect(contar(medicion.resultados, 201)).toBe(1);
      expect(contar(medicion.resultados, 409)).toBe(49);
      expect(await confirmadasEnZona(zonaId)).toBe(1);
    } finally {
      await Promise.all(replicas.map((replica) => replica.detener()));
    }
  });
});
