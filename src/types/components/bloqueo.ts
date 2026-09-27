export interface BloqueoRow {
  id: string;
  zona_id: string;
  inicio: Date;
  fin: Date;
  motivo: string;
  creado_por_user_id: string;
  created_at: Date;
  eliminado_en: Date | null;
  eliminado_por_user_id: string | null;
}

export interface BloqueoDto {
  id: number;
  zonaId: number;
  inicio: string;
  fin: string;
  motivo: string;
  creadoPorUserId: number;
  createdAt: string;
}
