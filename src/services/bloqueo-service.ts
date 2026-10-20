import knex from "../db/knex";
import Calendario from "../lib/calendario";
import DomainError from "../lib/domain-error";
import Errores from "../lib/errores";
import EventsPublisher from "../lib/events-publisher";
import BloqueoRepository from "../repositories/bloqueo-repository";
import ReservaRepository from "../repositories/reserva-repository";
import ZonaRepository from "../repositories/zona-repository";
import type { BloqueoDto, BloqueoRow } from "../types/components/bloqueo";
import type { ReservaDto } from "../types/components/reserva";
import HttpStatus from "../types/enums/http-status";
import CancelacionService from "./cancelacion-service";
import ReservaMapper from "./reserva-mapper";

export interface RangoLocal {
  inicio: string;
  fin: string;
}

export interface NuevoBloqueoInput extends RangoLocal {
  motivo: string;
  cancelarReservasAfectadas: boolean;
}

export interface BloqueoCreado {
  bloqueo: BloqueoDto;
  reservasCanceladas: ReservaDto[];
}

function toDto(row: BloqueoRow): BloqueoDto {
  return {
    id: Number(row.id),
    zonaId: Number(row.zona_id),
    inicio: row.inicio.toISOString(),
    fin: row.fin.toISOString(),
    motivo: row.motivo,
    creadoPorUserId: Number(row.creado_por_user_id),
    createdAt: row.created_at.toISOString(),
  };
}

function aInstantes(rango: RangoLocal): { inicio: Date; fin: Date } {
  const [fechaInicio, horaInicio] = rango.inicio.split("T") as [string, string];
  const [fechaFin, horaFin] = rango.fin.split("T") as [string, string];
  const inicio = Calendario.instante(fechaInicio, horaInicio);
  const fin = Calendario.instante(fechaFin, horaFin);

  if (fin.getTime() <= inicio.getTime()) {
    throw new DomainError(HttpStatus.UnprocessableEntity, "RANGO_INVALIDO", "La fecha de fin del bloqueo debe ser posterior a la de inicio.");
  }
  return { inicio, fin };
}

class BloqueoService {
  public static async listar(zonaId: number): Promise<BloqueoDto[]> {
    if (!(await ZonaRepository.findById(zonaId))) throw Errores.zonaNoEncontrada();
    return (await BloqueoRepository.findVigentesDeZona(zonaId)).map(toDto);
  }

  public static async reservasAfectadas(zonaId: number, rango: RangoLocal): Promise<ReservaDto[]> {
    if (!(await ZonaRepository.findById(zonaId))) throw Errores.zonaNoEncontrada();
    const { inicio, fin } = aInstantes(rango);
    const reservas = await ReservaRepository.findConfirmadasFuturasEnRango(knex, zonaId, inicio, fin, new Date());
    return reservas.map(ReservaMapper.toDto);
  }

  public static async crear(zonaId: number, input: NuevoBloqueoInput, adminUserId: number): Promise<BloqueoCreado> {
    const { inicio, fin } = aInstantes(input);
    const ahora = new Date();

    const resultado = await knex.transaction(async (trx) => {
      if (!(await ZonaRepository.findByIdForUpdate(trx, zonaId))) throw Errores.zonaNoEncontrada();

      const afectadas = await ReservaRepository.findConfirmadasFuturasEnRango(trx, zonaId, inicio, fin, ahora);
      if (afectadas.length > 0 && !input.cancelarReservasAfectadas) {
        throw new DomainError(
          HttpStatus.Conflict,
          "RESERVAS_AFECTADAS",
          `Hay ${afectadas.length} reservas confirmadas dentro del rango. Confirma con cancelarReservasAfectadas: true para cancelarlas junto con el bloqueo.`,
          { reservas: afectadas.map(ReservaMapper.toDto) },
        );
      }

      for (const reserva of afectadas) {
        await CancelacionService.cancelarEnTransaccion(
          trx,
          Number(reserva.id),
          { porUserId: adminUserId, tipo: "MANTENIMIENTO", motivo: `Mantenimiento: ${input.motivo}` },
          { exigirAnticipacion: false },
          ahora,
        );
      }

      const bloqueo = await BloqueoRepository.insert(trx, { zonaId, inicio, fin, motivo: input.motivo, creadoPorUserId: adminUserId });
      return { bloqueo, canceladas: afectadas.map((reserva) => Number(reserva.id)) };
    });

    const reservasCanceladas = await Promise.all(
      resultado.canceladas.map(async (id) => ReservaMapper.toDto((await ReservaRepository.findById(id))!)),
    );

    await EventsPublisher.publish("bloqueo.creado", { zonaId, bloqueoId: Number(resultado.bloqueo.id) });
    for (const reserva of reservasCanceladas) {
      await EventsPublisher.publish("reserva.cancelada", { reservaId: reserva.id, zonaId, apartamentoId: reserva.apartamento.id, tipo: "MANTENIMIENTO" });
    }

    return { bloqueo: toDto(resultado.bloqueo), reservasCanceladas };
  }

  public static async eliminar(zonaId: number, bloqueoId: number, adminUserId: number): Promise<void> {
    const eliminado = await BloqueoRepository.eliminar(zonaId, bloqueoId, adminUserId);
    if (!eliminado) {
      throw new DomainError(HttpStatus.NotFound, "BLOQUEO_NO_ENCONTRADO", "El bloqueo no existe o ya fue eliminado.");
    }
    await EventsPublisher.publish("bloqueo.eliminado", { zonaId, bloqueoId });
  }
}

export default BloqueoService;
