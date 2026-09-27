import type { Knex } from "knex";
import knex from "../../../src/db/knex";
import PgErrors, { PG_DEADLOCK_DETECTED, PG_EXCLUSION_VIOLATION } from "../../../src/lib/pg-errors";
import RegistroReservas from "../../../src/services/registro-reservas";

export type Resultado = "confirmada" | "conflicto";

export interface Solicitud {
  zonaId: number;
  aforo: number;
  fecha: string;
  horaInicio: string;
  inicio: Date;
  fin: Date;
  apartamentoId: number;
}

export type Estrategia = (solicitud: Solicitud) => Promise<Resultado>;

const VENTANA_DE_CARRERA_MS = 15;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function asegurarFranja(trx: Knex | Knex.Transaction, solicitud: Solicitud): Promise<void> {
  await trx("franjas_ocupacion")
    .insert({ zona_id: solicitud.zonaId, inicio: solicitud.inicio, fin: solicitud.fin, aforo: solicitud.aforo, ocupados: 0 })
    .onConflict(["zona_id", "inicio"])
    .ignore();
}

async function confirmadas(trx: Knex | Knex.Transaction, solicitud: Solicitud): Promise<number> {
  const [fila] = await trx("reservas")
    .where({ zona_id: solicitud.zonaId, estado: "CONFIRMADA" })
    .andWhere("inicio", "<", solicitud.fin)
    .andWhere("fin", ">", solicitud.inicio)
    .count<{ count: string }[]>({ count: "*" });
  return Number(fila?.count ?? 0);
}

async function insertarReserva(trx: Knex | Knex.Transaction, solicitud: Solicitud, exclusiva: boolean): Promise<void> {
  await trx("reservas").insert({
    zona_id: solicitud.zonaId,
    apartamento_id: solicitud.apartamentoId,
    apartamento_torre: "T",
    apartamento_numero: String(solicitud.apartamentoId),
    residente_user_id: solicitud.apartamentoId * 10,
    residente_nombre: "Residente de carga",
    inicio: solicitud.inicio,
    fin: solicitud.fin,
    exclusiva,
  });
}

async function consultarYLuegoInsertar(solicitud: Solicitud): Promise<Resultado> {
  await asegurarFranja(knex, solicitud);
  if ((await confirmadas(knex, solicitud)) >= solicitud.aforo) return "conflicto";
  await esperar(VENTANA_DE_CARRERA_MS);
  await insertarReserva(knex, solicitud, false);
  return "confirmada";
}

export const sinMecanismo: Estrategia = consultarYLuegoInsertar;

export function mutexEnProceso(): Estrategia {
  let cola: Promise<unknown> = Promise.resolve();
  return (solicitud) => {
    const turno = cola.then(() => consultarYLuegoInsertar(solicitud));
    cola = turno.catch(() => undefined);
    return turno;
  };
}

export const bloqueoPesimistaDeZona: Estrategia = (solicitud) =>
  knex.transaction(async (trx) => {
    await trx("zonas_comunes").where("id", solicitud.zonaId).forUpdate().first();
    await asegurarFranja(trx, solicitud);
    if ((await confirmadas(trx, solicitud)) >= solicitud.aforo) return "conflicto";
    await esperar(VENTANA_DE_CARRERA_MS);
    await insertarReserva(trx, solicitud, false);
    return "confirmada";
  });

export const restriccionDeExclusion: Estrategia = async (solicitud) => {
  await asegurarFranja(knex, solicitud);
  await esperar(VENTANA_DE_CARRERA_MS);
  try {
    await insertarReserva(knex, solicitud, true);
    return "confirmada";
  } catch (error) {
    if (PgErrors.es(error, PG_EXCLUSION_VIOLATION) || PgErrors.es(error, PG_DEADLOCK_DETECTED)) return "conflicto";
    throw error;
  }
};

export const contadorAtomico: Estrategia = async (solicitud) => {
  try {
    await RegistroReservas.registrar(
      { zonaId: solicitud.zonaId, fecha: solicitud.fecha, horaInicio: solicitud.horaInicio },
      { userId: solicitud.apartamentoId * 10, nombre: "Residente de carga", apartamento: null },
      { id: solicitud.apartamentoId, torre: "T", numero: String(solicitud.apartamentoId) },
    );
    return "confirmada";
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 409) return "conflicto";
    throw error;
  }
};
