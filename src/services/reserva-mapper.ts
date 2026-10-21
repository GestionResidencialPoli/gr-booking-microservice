import Calendario from "../lib/calendario";
import type { ReservaDto, ReservaRow } from "../types/components/reserva";

class ReservaMapper {
  public static toDto(row: ReservaRow): ReservaDto {
    return {
      id: Number(row.id),
      zona: { id: Number(row.zona_id), nombre: row.zona_nombre ?? null },
      apartamento: { id: Number(row.apartamento_id), torre: row.apartamento_torre, numero: row.apartamento_numero },
      residente: { userId: Number(row.residente_user_id), nombre: row.residente_nombre },
      fecha: Calendario.fechaLocal(row.inicio),
      horaInicio: Calendario.horaLocal(row.inicio),
      horaFin: Calendario.horaLocal(row.fin),
      inicio: row.inicio.toISOString(),
      fin: row.fin.toISOString(),
      estado: row.estado,
      cancelacion:
        row.estado === "CANCELADA" && row.cancelada_en && row.cancelacion_tipo
          ? {
              canceladaEn: row.cancelada_en.toISOString(),
              canceladaPorUserId: Number(row.cancelada_por_user_id),
              tipo: row.cancelacion_tipo,
              motivo: row.cancelacion_motivo,
            }
          : null,
      createdAt: row.created_at.toISOString(),
    };
  }
}

export default ReservaMapper;
