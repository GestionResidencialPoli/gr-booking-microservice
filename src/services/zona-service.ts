import type { Knex } from "knex";
import knex from "../db/knex";
import Calendario from "../lib/calendario";
import Errores from "../lib/errores";
import EventsPublisher from "../lib/events-publisher";
import PgErrors, { PG_CHECK_VIOLATION, PG_UNIQUE_VIOLATION } from "../lib/pg-errors";
import FranjaRepository from "../repositories/franja-repository";
import ReservaRepository from "../repositories/reserva-repository";
import ZonaRepository from "../repositories/zona-repository";
import type { ReservaDto } from "../types/components/reserva";
import type { ZonaComunDto, ZonaComunInput, ZonaComunRow } from "../types/components/zona";
import ReservaMapper from "./reserva-mapper";

function toDto(row: ZonaComunRow): ZonaComunDto {
  const horario = {
    horaApertura: row.hora_apertura,
    horaCierre: row.hora_cierre,
    duracionFranjaMinutos: row.duracion_franja_minutos,
  };

  return {
    id: Number(row.id),
    nombre: row.nombre,
    descripcion: row.descripcion,
    horaApertura: Calendario.horaCorta(row.hora_apertura),
    horaCierre: Calendario.horaCorta(row.hora_cierre),
    duracionFranjaMinutos: row.duracion_franja_minutos,
    aforo: row.aforo,
    anticipacionMinimaHoras: row.anticipacion_minima_horas,
    anticipacionMaximaDias: row.anticipacion_maxima_dias,
    anticipacionCancelacionHoras: row.anticipacion_cancelacion_horas,
    activa: row.activa,
    franjasPorDia: Math.ceil(Calendario.minutosDeOperacion(horario) / row.duracion_franja_minutos),
    ultimaFranjaIncompleta: Calendario.ultimaFranjaIncompleta(horario),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function horarioCambio(actual: ZonaComunRow, input: ZonaComunInput): boolean {
  return (
    Calendario.horaCorta(actual.hora_apertura) !== input.horaApertura ||
    Calendario.horaCorta(actual.hora_cierre) !== input.horaCierre ||
    actual.duracion_franja_minutos !== input.duracionFranjaMinutos
  );
}

async function conNombreUnico<T>(nombre: string, operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (PgErrors.es(error, PG_UNIQUE_VIOLATION)) throw Errores.zonaDuplicada(nombre);
    throw error;
  }
}

export interface DesactivacionResult {
  zona: ZonaComunDto;
  reservasFuturas: ReservaDto[];
}

class ZonaService {
  public static validarHorario(input: ZonaComunInput): void {
    const minutosOperacion = Calendario.minutosDeOperacion(input);

    if (minutosOperacion <= 0) throw Errores.horarioInvalido();
    if (input.duracionFranjaMinutos > minutosOperacion) throw Errores.duracionFranjaInvalida();

    const residuo = minutosOperacion % input.duracionFranjaMinutos;
    if (residuo !== 0 && !input.confirmarFranjaIncompleta) {
      throw Errores.franjaIncompleta(residuo, Math.ceil(minutosOperacion / input.duracionFranjaMinutos));
    }
  }

  public static async listar(incluirInactivas: boolean): Promise<ZonaComunDto[]> {
    const rows = await ZonaRepository.findAll(incluirInactivas);
    return rows.map(toDto);
  }

  public static async obtener(id: number, puedeVerInactivas: boolean): Promise<ZonaComunDto> {
    const row = await ZonaRepository.findById(id);
    if (!row || (!row.activa && !puedeVerInactivas)) throw Errores.zonaNoEncontrada();
    return toDto(row);
  }

  public static async crear(input: ZonaComunInput): Promise<ZonaComunDto> {
    ZonaService.validarHorario(input);
    if (await ZonaRepository.existsNombre(input.nombre)) throw Errores.zonaDuplicada(input.nombre);

    const row = await conNombreUnico(input.nombre, () => ZonaRepository.insert(input));
    await EventsPublisher.publish("zona.creada", { zonaId: Number(row.id) });
    return toDto(row);
  }

  public static async actualizar(id: number, input: ZonaComunInput): Promise<ZonaComunDto> {
    ZonaService.validarHorario(input);
    if (await ZonaRepository.existsNombre(input.nombre, id)) throw Errores.zonaDuplicada(input.nombre);

    const row = await conNombreUnico(input.nombre, () =>
      knex.transaction(async (trx) => {
        const actual = await ZonaRepository.findByIdForUpdate(trx, id);
        if (!actual) throw Errores.zonaNoEncontrada();

        if (horarioCambio(actual, input) && (await ReservaRepository.existenFuturasConfirmadas(trx, id))) {
          throw Errores.zonaConReservasFuturas();
        }

        const actualizada = await ZonaRepository.update(trx, id, input);
        await ZonaService.propagarAforo(trx, id, input.aforo);
        return actualizada;
      }),
    );

    await EventsPublisher.publish("zona.actualizada", { zonaId: id });
    return toDto(row);
  }

  public static async cambiarActivacion(id: number, activa: boolean): Promise<DesactivacionResult> {
    const resultado = await knex.transaction(async (trx) => {
      const actual = await ZonaRepository.findByIdForUpdate(trx, id);
      if (!actual) throw Errores.zonaNoEncontrada();

      const zona = await ZonaRepository.setActiva(trx, id, activa);
      const reservasFuturas = await ReservaRepository.findFuturasConfirmadasDeZona(trx, id);
      return { zona: toDto(zona), reservasFuturas: reservasFuturas.map(ReservaMapper.toDto) };
    });

    await EventsPublisher.publish(activa ? "zona.activada" : "zona.desactivada", { zonaId: id });
    return resultado;
  }

  private static async propagarAforo(trx: Knex.Transaction, id: number, aforo: number): Promise<void> {
    try {
      await FranjaRepository.actualizarAforoFuturo(trx, id, aforo);
    } catch (error) {
      if (PgErrors.es(error, PG_CHECK_VIOLATION, "ck_franjas_ocupados")) throw Errores.aforoMenorQueOcupacion();
      throw error;
    }
  }
}

export default ZonaService;
