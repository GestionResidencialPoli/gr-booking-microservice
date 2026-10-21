import HttpStatus from "../types/enums/http-status";
import DomainError from "./domain-error";

class Errores {
  public static zonaNoEncontrada(): DomainError {
    return new DomainError(HttpStatus.NotFound, "ZONA_NO_ENCONTRADA", "La zona comun no existe.");
  }

  public static zonaDuplicada(nombre: string): DomainError {
    return new DomainError(HttpStatus.Conflict, "ZONA_DUPLICADA", `Ya existe una zona comun llamada "${nombre}".`);
  }

  public static horarioInvalido(): DomainError {
    return new DomainError(
      HttpStatus.UnprocessableEntity,
      "HORARIO_INVALIDO",
      "La hora de cierre debe ser posterior a la hora de apertura.",
    );
  }

  public static duracionFranjaInvalida(): DomainError {
    return new DomainError(
      HttpStatus.UnprocessableEntity,
      "DURACION_FRANJA_INVALIDA",
      "La duracion de la franja no puede superar el horario de la zona.",
    );
  }

  public static franjaIncompleta(minutosUltimaFranja: number, franjasPorDia: number): DomainError {
    return new DomainError(
      HttpStatus.UnprocessableEntity,
      "FRANJA_INCOMPLETA",
      `La duracion no cabe un numero entero de veces en el horario: la ultima franja quedaria de ${minutosUltimaFranja} minutos. Confirma con confirmarFranjaIncompleta=true.`,
      { minutosUltimaFranja, franjasPorDia },
    );
  }

  public static zonaConReservasFuturas(): DomainError {
    return new DomainError(
      HttpStatus.Conflict,
      "ZONA_CON_RESERVAS_FUTURAS",
      "No se puede cambiar el horario ni la duracion de la franja mientras la zona tenga reservas futuras confirmadas.",
    );
  }

  public static aforoMenorQueOcupacion(): DomainError {
    return new DomainError(
      HttpStatus.Conflict,
      "AFORO_MENOR_QUE_OCUPACION",
      "El nuevo aforo es menor que las reservas ya confirmadas en alguna franja futura.",
    );
  }
}

export default Errores;
