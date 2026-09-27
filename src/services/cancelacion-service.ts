import type { Knex } from "knex";
import knex from "../db/knex";
import DomainError from "../lib/domain-error";
import EventsPublisher from "../lib/events-publisher";
import UserServiceClient from "../lib/user-service-client";
import FranjaRepository from "../repositories/franja-repository";
import ReservaRepository, { type Cancelacion } from "../repositories/reserva-repository";
import ZonaRepository from "../repositories/zona-repository";
import type { ReservaDto, ReservaRow } from "../types/components/reserva";
import HttpStatus from "../types/enums/http-status";
import ReservaMapper from "./reserva-mapper";
import ReservaService from "./reserva-service";

const MS_POR_HORA = 3_600_000;

export interface PoliticaCancelacion {
  exigirAnticipacion: boolean;
  apartamentoId?: number;
}

function noEncontrada(): DomainError {
  return new DomainError(HttpStatus.NotFound, "RESERVA_NO_ENCONTRADA", "La reserva no existe.");
}

class CancelacionService {
  public static async cancelarPropia(userId: number, reservaId: number, ahora: Date = new Date()): Promise<ReservaDto> {
    const apartamento = ReservaService.apartamentoDe(await UserServiceClient.residente(userId));
    return CancelacionService.cancelar(
      reservaId,
      { porUserId: userId, tipo: "RESIDENTE", motivo: null },
      { exigirAnticipacion: true, apartamentoId: apartamento.id },
      ahora,
    );
  }

  public static async cancelar(
    reservaId: number,
    cancelacion: Cancelacion,
    politica: PoliticaCancelacion,
    ahora: Date = new Date(),
  ): Promise<ReservaDto> {
    const cancelada = await knex.transaction((trx) => CancelacionService.cancelarEnTransaccion(trx, reservaId, cancelacion, politica, ahora));
    const reserva = ReservaMapper.toDto((await ReservaRepository.findById(reservaId))!);

    if (cancelada) {
      await EventsPublisher.publish("reserva.cancelada", {
        reservaId,
        zonaId: reserva.zona.id,
        apartamentoId: reserva.apartamento.id,
        tipo: cancelacion.tipo,
      });
    }
    return reserva;
  }

  public static async cancelarEnTransaccion(
    trx: Knex.Transaction,
    reservaId: number,
    cancelacion: Cancelacion,
    politica: PoliticaCancelacion,
    ahora: Date,
  ): Promise<boolean> {
    const reserva = await ReservaRepository.findByIdForUpdate(trx, reservaId);
    if (!reserva) throw noEncontrada();
    if (politica.apartamentoId !== undefined && Number(reserva.apartamento_id) !== politica.apartamentoId) {
      throw new DomainError(HttpStatus.Forbidden, "RESERVA_AJENA", "La reserva pertenece a otro apartamento.");
    }
    if (reserva.estado === "CANCELADA") return false;

    await CancelacionService.validarTemporalidad(trx, reserva, politica, ahora);
    await ReservaRepository.cancelar(trx, reservaId, cancelacion);
    await FranjaRepository.liberarCupo(trx, Number(reserva.zona_id), reserva.inicio);
    return true;
  }

  private static async validarTemporalidad(trx: Knex.Transaction, reserva: ReservaRow, politica: PoliticaCancelacion, ahora: Date) {
    if (reserva.inicio.getTime() <= ahora.getTime()) {
      throw new DomainError(HttpStatus.UnprocessableEntity, "RESERVA_PASADA", "No se puede cancelar una reserva que ya comenzo o termino.");
    }
    if (!politica.exigirAnticipacion) return;

    const zona = await ZonaRepository.findById(Number(reserva.zona_id), trx);
    const horas = zona?.anticipacion_cancelacion_horas ?? 0;
    if (reserva.inicio.getTime() - ahora.getTime() < horas * MS_POR_HORA) {
      throw new DomainError(
        HttpStatus.UnprocessableEntity,
        "ANTICIPACION_CANCELACION",
        `Esta zona solo permite cancelar con al menos ${horas} horas de anticipacion.`,
        { anticipacionCancelacionHoras: horas },
      );
    }
  }
}

export default CancelacionService;
