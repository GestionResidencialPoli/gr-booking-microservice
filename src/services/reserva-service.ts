import DomainError from "../lib/domain-error";
import EventsPublisher from "../lib/events-publisher";
import UserServiceClient, { type Residente } from "../lib/user-service-client";
import ReservaRepository from "../repositories/reserva-repository";
import type { ReservaDto } from "../types/components/reserva";
import HttpStatus from "../types/enums/http-status";
import RegistroReservas, { type ApartamentoValidado, type SolicitudReserva } from "./registro-reservas";
import ReservaMapper from "./reserva-mapper";

class ReservaService {
  public static apartamentoDe(residente: Residente): ApartamentoValidado {
    const apartamento = residente.apartamento;
    if (!apartamento) {
      throw new DomainError(
        HttpStatus.UnprocessableEntity,
        "SIN_APARTAMENTO",
        "Tu usuario no esta vinculado a ningun apartamento como propietario o arrendatario.",
      );
    }
    if (!apartamento.activo) {
      throw new DomainError(HttpStatus.UnprocessableEntity, "APARTAMENTO_INACTIVO", "El apartamento vinculado esta inactivo.");
    }
    return { id: apartamento.id, torre: apartamento.torre, numero: apartamento.numero };
  }

  public static async reservar(userId: number, solicitud: SolicitudReserva): Promise<ReservaDto> {
    const residente = await UserServiceClient.residente(userId);
    const apartamento = ReservaService.apartamentoDe(residente);

    const reservaId = await RegistroReservas.registrar(solicitud, residente, apartamento);
    const reserva = ReservaMapper.toDto((await ReservaRepository.findById(reservaId))!);

    await EventsPublisher.publish("reserva.creada", {
      reservaId,
      zonaId: reserva.zona.id,
      apartamentoId: apartamento.id,
      inicio: reserva.inicio,
      fin: reserva.fin,
    });
    return reserva;
  }
}

export default ReservaService;
