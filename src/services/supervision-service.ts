import Calendario from "../lib/calendario";
import ReservaRepository from "../repositories/reserva-repository";
import type { PageResult } from "../types/components/page";
import type { ReservaDto } from "../types/components/reserva";
import CancelacionService from "./cancelacion-service";
import ReservaMapper from "./reserva-mapper";

export interface FiltroSupervision {
  zonaId?: number;
  desde?: string;
  hasta?: string;
  estado?: "CONFIRMADA" | "CANCELADA";
  page: number;
  size: number;
}

class SupervisionService {
  public static async listar(filtro: FiltroSupervision): Promise<PageResult<ReservaDto>> {
    const { rows, total } = await ReservaRepository.findPage({
      zonaId: filtro.zonaId,
      estado: filtro.estado,
      desde: filtro.desde ? Calendario.instante(filtro.desde, "00:00") : undefined,
      hasta: filtro.hasta ? Calendario.instante(Calendario.sumarDias(filtro.hasta, 1), "00:00") : undefined,
      page: filtro.page,
      size: filtro.size,
    });

    return {
      content: rows.map(ReservaMapper.toDto),
      page: filtro.page,
      size: filtro.size,
      totalElements: total,
      totalPages: Math.ceil(total / filtro.size),
    };
  }

  public static async cancelar(adminUserId: number, reservaId: number, motivo: string): Promise<ReservaDto> {
    return CancelacionService.cancelar(
      reservaId,
      { porUserId: adminUserId, tipo: "ADMINISTRACION", motivo },
      { exigirAnticipacion: false },
    );
  }
}

export default SupervisionService;
