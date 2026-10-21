import type { EstadoFranja } from "../../services/disponibilidad-calculator";

export interface FranjaDisponibilidadDto {
  inicio: string;
  fin: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoFranja;
  aforo: number;
  cuposRestantes: number;
  motivoBloqueo: string | null;
}

export interface DiaDisponibilidadDto {
  fecha: string;
  franjas: FranjaDisponibilidadDto[];
}

export interface DisponibilidadDto {
  zonaId: number;
  desde: string;
  hasta: string;
  consultadaEn: string;
  dias: DiaDisponibilidadDto[];
}
