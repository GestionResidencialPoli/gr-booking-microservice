export type EstadoReserva = "CONFIRMADA" | "CANCELADA";
export type TipoCancelacion = "RESIDENTE" | "ADMINISTRACION" | "MANTENIMIENTO";

export interface ReservaRow {
  id: string;
  zona_id: string;
  zona_nombre?: string;
  apartamento_id: string;
  apartamento_torre: string;
  apartamento_numero: string;
  residente_user_id: string;
  residente_nombre: string;
  inicio: Date;
  fin: Date;
  estado: EstadoReserva;
  exclusiva: boolean;
  cancelada_en: Date | null;
  cancelada_por_user_id: string | null;
  cancelacion_tipo: TipoCancelacion | null;
  cancelacion_motivo: string | null;
  created_at: Date;
}

export interface ReservaDto {
  id: number;
  zona: { id: number; nombre: string | null };
  apartamento: { id: number; torre: string; numero: string };
  residente: { userId: number; nombre: string };
  fecha: string;
  horaInicio: string;
  horaFin: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  cancelacion: {
    canceladaEn: string;
    canceladaPorUserId: number;
    tipo: TipoCancelacion;
    motivo: string | null;
  } | null;
  createdAt: string;
}
