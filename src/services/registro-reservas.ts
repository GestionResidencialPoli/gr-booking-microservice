import type { Knex } from "knex";
import config from "../config";
import knex from "../db/knex";
import Calendario from "../lib/calendario";
import DomainError from "../lib/domain-error";
import Errores from "../lib/errores";
import Logger from "../lib/logger";
import PgErrors, { PG_CHECK_VIOLATION, PG_DEADLOCK_DETECTED, PG_EXCLUSION_VIOLATION } from "../lib/pg-errors";
import type { Residente } from "../lib/user-service-client";
import BloqueoRepository from "../repositories/bloqueo-repository";
import FranjaRepository from "../repositories/franja-repository";
import Locks from "../repositories/locks";
import ReservaRepository from "../repositories/reserva-repository";
import ZonaRepository from "../repositories/zona-repository";
import HttpStatus from "../types/enums/http-status";
import type { ConsultaPazYSalvo } from "./paz-y-salvo/consulta-paz-y-salvo";
import carteraReplicada from "./paz-y-salvo/cartera-replicada";
import ReglasReserva from "./reglas-reserva";

export interface SolicitudReserva {
  zonaId: number;
  fecha: string;
  horaInicio: string;
}

export interface ApartamentoValidado {
  id: number;
  torre: string;
  numero: string;
}

function franjaSinCupo(): DomainError {
  return new DomainError(
    HttpStatus.Conflict,
    "FRANJA_SIN_CUPO",
    "Esta franja acaba de ser tomada por otro residente y ya no tiene cupo. Elige otra franja.",
  );
}

class RegistroReservas {
  private static pazYSalvo: ConsultaPazYSalvo = carteraReplicada;

  public static usarConsultaPazYSalvo(consulta: ConsultaPazYSalvo): void {
    RegistroReservas.pazYSalvo = consulta;
  }

  public static async registrar(
    solicitud: SolicitudReserva,
    residente: Residente,
    apartamento: ApartamentoValidado,
    ahora: Date = new Date(),
  ): Promise<number> {
    try {
      return await knex.transaction((trx) => RegistroReservas.seccionCritica(trx, solicitud, residente, apartamento, ahora));
    } catch (error) {
      if (
        PgErrors.es(error, PG_EXCLUSION_VIOLATION) ||
        PgErrors.es(error, PG_DEADLOCK_DETECTED) ||
        PgErrors.es(error, PG_CHECK_VIOLATION, "ck_franjas_ocupados")
      ) {
        RegistroReservas.registrarConflicto(solicitud, "restriccion de base de datos");
        throw franjaSinCupo();
      }
      throw error;
    }
  }

  private static async seccionCritica(
    trx: Knex.Transaction,
    solicitud: SolicitudReserva,
    residente: Residente,
    apartamento: ApartamentoValidado,
    ahora: Date,
  ): Promise<number> {
    await Locks.apartamento(trx, apartamento.id);

    const zona = await ZonaRepository.findByIdForShare(trx, solicitud.zonaId);
    if (!zona) throw Errores.zonaNoEncontrada();

    const horario = {
      horaApertura: zona.hora_apertura,
      horaCierre: zona.hora_cierre,
      duracionFranjaMinutos: zona.duracion_franja_minutos,
    };
    const franja = Calendario.franjaQueIniciaA(horario, solicitud.fecha, solicitud.horaInicio);
    if (!franja) {
      throw new DomainError(HttpStatus.UnprocessableEntity, "FRANJA_INVALIDA", "La hora indicada no corresponde al inicio de una franja de la zona.");
    }

    const [bloqueos, reservasActivas, pazYSalvo] = await Promise.all([
      BloqueoRepository.findVigentesEnRango(solicitud.zonaId, franja.inicio, franja.fin, trx),
      ReservaRepository.contarActivasFuturas(trx, apartamento.id, ahora),
      RegistroReservas.pazYSalvo.estaAPazYSalvo(apartamento.id, trx),
    ]);

    ReglasReserva.validar({
      zona: {
        activa: zona.activa,
        anticipacionMinimaHoras: zona.anticipacion_minima_horas,
        anticipacionMaximaDias: zona.anticipacion_maxima_dias,
      },
      franja,
      ahora,
      bloqueos,
      reservasActivasDelApartamento: reservasActivas,
      maxReservasActivas: config.reservas.maxActivasPorApartamento,
      pazYSalvo,
    });

    await FranjaRepository.asegurar(trx, solicitud.zonaId, franja.inicio, franja.fin, zona.aforo);
    const cupo = await FranjaRepository.tomarCupo(trx, solicitud.zonaId, franja.inicio);
    if (!cupo) {
      RegistroReservas.registrarConflicto(solicitud, "franja sin cupo");
      throw franjaSinCupo();
    }

    return ReservaRepository.insert(trx, {
      zonaId: solicitud.zonaId,
      apartamento,
      residente: { userId: residente.userId, nombre: residente.nombre },
      inicio: franja.inicio,
      fin: franja.fin,
      exclusiva: zona.aforo === 1,
    });
  }

  private static registrarConflicto(solicitud: SolicitudReserva, causa: string): void {
    Logger.warn("Conflicto de concurrencia al reservar", {
      zonaId: solicitud.zonaId,
      franja: `${solicitud.fecha} ${solicitud.horaInicio}`,
      causa,
    });
  }
}

export default RegistroReservas;
