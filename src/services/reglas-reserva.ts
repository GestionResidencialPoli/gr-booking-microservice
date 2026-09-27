import type { Franja } from "../lib/calendario";
import DomainError from "../lib/domain-error";
import HttpStatus from "../types/enums/http-status";
import DisponibilidadCalculator, { type BloqueoVigente } from "./disponibilidad-calculator";

const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;

export interface ZonaParaReglas {
  activa: boolean;
  anticipacionMinimaHoras: number;
  anticipacionMaximaDias: number;
}

export interface ContextoReserva {
  zona: ZonaParaReglas;
  franja: Franja;
  ahora: Date;
  bloqueos: BloqueoVigente[];
  reservasActivasDelApartamento: number;
  maxReservasActivas: number;
  pazYSalvo: boolean;
}

function incumple(code: string, message: string, details?: unknown): DomainError {
  return new DomainError(HttpStatus.UnprocessableEntity, code, message, details);
}

class ReglasReserva {
  public static zonaActiva({ zona }: ContextoReserva): DomainError | null {
    return zona.activa ? null : incumple("ZONA_INACTIVA", "La zona no admite reservas en este momento.");
  }

  public static franjaSinBloqueo({ franja, bloqueos }: ContextoReserva): DomainError | null {
    const bloqueo = DisponibilidadCalculator.bloqueoQueCubre(franja, bloqueos);
    return bloqueo
      ? incumple("FRANJA_BLOQUEADA", `La franja esta bloqueada por mantenimiento: ${bloqueo.motivo}`, { motivo: bloqueo.motivo })
      : null;
  }

  public static anticipacion({ zona, franja, ahora }: ContextoReserva): DomainError | null {
    const inicio = franja.inicio.getTime();
    if (inicio <= ahora.getTime()) {
      return incumple("FRANJA_PASADA", "No se puede reservar una franja que ya comenzo.");
    }
    if (inicio < ahora.getTime() + zona.anticipacionMinimaHoras * MS_POR_HORA) {
      return incumple(
        "ANTICIPACION_MINIMA",
        `Esta zona se debe reservar con al menos ${zona.anticipacionMinimaHoras} horas de anticipacion.`,
        { anticipacionMinimaHoras: zona.anticipacionMinimaHoras },
      );
    }
    if (inicio > ahora.getTime() + zona.anticipacionMaximaDias * MS_POR_DIA) {
      return incumple(
        "ANTICIPACION_MAXIMA",
        `Esta zona se puede reservar con maximo ${zona.anticipacionMaximaDias} dias de anticipacion.`,
        { anticipacionMaximaDias: zona.anticipacionMaximaDias },
      );
    }
    return null;
  }

  public static limiteDeReservasActivas({ reservasActivasDelApartamento, maxReservasActivas }: ContextoReserva): DomainError | null {
    return reservasActivasDelApartamento >= maxReservasActivas
      ? incumple(
          "LIMITE_RESERVAS_ACTIVAS",
          `El apartamento ya tiene ${maxReservasActivas} reservas futuras activas, que es el maximo permitido.`,
          { maxReservasActivas },
        )
      : null;
  }

  public static pazYSalvo({ pazYSalvo }: ContextoReserva): DomainError | null {
    return pazYSalvo
      ? null
      : incumple("SIN_PAZ_Y_SALVO", "El apartamento debe estar a paz y salvo con la administracion para reservar.");
  }

  public static validar(contexto: ContextoReserva): void {
    const reglas = [
      ReglasReserva.zonaActiva,
      ReglasReserva.franjaSinBloqueo,
      ReglasReserva.anticipacion,
      ReglasReserva.limiteDeReservasActivas,
      ReglasReserva.pazYSalvo,
    ];

    for (const regla of reglas) {
      const error = regla(contexto);
      if (error) throw error;
    }
  }
}

export default ReglasReserva;
