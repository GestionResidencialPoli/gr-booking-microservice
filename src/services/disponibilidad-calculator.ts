import type { Franja } from "../lib/calendario";

export type EstadoFranja = "DISPONIBLE" | "PARCIAL" | "COMPLETA" | "BLOQUEADA" | "FUERA_DE_ANTICIPACION";

export interface BloqueoVigente {
  inicio: Date;
  fin: Date;
  motivo: string;
}

export interface ReglasAnticipacion {
  anticipacionMinimaHoras: number;
  anticipacionMaximaDias: number;
}

export interface EstadoCalculado {
  estado: EstadoFranja;
  cuposRestantes: number;
  motivoBloqueo: string | null;
}

const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;

class DisponibilidadCalculator {
  public static bloqueoQueCubre(franja: Franja, bloqueos: BloqueoVigente[]): BloqueoVigente | undefined {
    return bloqueos.find((bloqueo) => bloqueo.inicio < franja.fin && bloqueo.fin > franja.inicio);
  }

  public static dentroDeAnticipacion(franja: Franja, reglas: ReglasAnticipacion, ahora: Date): boolean {
    const primeraPermitida = ahora.getTime() + reglas.anticipacionMinimaHoras * MS_POR_HORA;
    const ultimaPermitida = ahora.getTime() + reglas.anticipacionMaximaDias * MS_POR_DIA;
    const inicio = franja.inicio.getTime();
    return inicio >= primeraPermitida && inicio <= ultimaPermitida;
  }

  public static estado(
    franja: Franja,
    aforo: number,
    ocupados: number,
    bloqueos: BloqueoVigente[],
    reglas: ReglasAnticipacion,
    ahora: Date,
  ): EstadoCalculado {
    const cuposRestantes = Math.max(aforo - ocupados, 0);
    const bloqueo = DisponibilidadCalculator.bloqueoQueCubre(franja, bloqueos);

    if (bloqueo) return { estado: "BLOQUEADA", cuposRestantes, motivoBloqueo: bloqueo.motivo };
    if (!DisponibilidadCalculator.dentroDeAnticipacion(franja, reglas, ahora)) {
      return { estado: "FUERA_DE_ANTICIPACION", cuposRestantes, motivoBloqueo: null };
    }
    if (cuposRestantes === 0) return { estado: "COMPLETA", cuposRestantes, motivoBloqueo: null };
    if (ocupados > 0) return { estado: "PARCIAL", cuposRestantes, motivoBloqueo: null };
    return { estado: "DISPONIBLE", cuposRestantes, motivoBloqueo: null };
  }
}

export default DisponibilidadCalculator;
