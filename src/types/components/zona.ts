export interface ZonaComunRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  hora_apertura: string;
  hora_cierre: string;
  duracion_franja_minutos: number;
  aforo: number;
  anticipacion_minima_horas: number;
  anticipacion_maxima_dias: number;
  anticipacion_cancelacion_horas: number;
  activa: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ZonaComunDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  horaApertura: string;
  horaCierre: string;
  duracionFranjaMinutos: number;
  aforo: number;
  anticipacionMinimaHoras: number;
  anticipacionMaximaDias: number;
  anticipacionCancelacionHoras: number;
  activa: boolean;
  franjasPorDia: number;
  ultimaFranjaIncompleta: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZonaComunInput {
  nombre: string;
  descripcion?: string | null;
  horaApertura: string;
  horaCierre: string;
  duracionFranjaMinutos: number;
  aforo: number;
  anticipacionMinimaHoras: number;
  anticipacionMaximaDias: number;
  anticipacionCancelacionHoras: number;
  confirmarFranjaIncompleta: boolean;
}
