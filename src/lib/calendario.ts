import config from "../config";

const MINUTOS_POR_HORA = 60;
const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 24 * MINUTOS_POR_HORA * MS_POR_MINUTO;

export interface Franja {
  inicio: Date;
  fin: Date;
}

export interface HorarioZona {
  horaApertura: string;
  horaCierre: string;
  duracionFranjaMinutos: number;
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

function offsetEnMinutos(): number {
  const [signo, horas, minutos] = [config.zonaHoraria.offset[0], ...config.zonaHoraria.offset.slice(1).split(":")];
  const valor = Number(horas) * MINUTOS_POR_HORA + Number(minutos);
  return signo === "-" ? -valor : valor;
}

class Calendario {
  public static minutosDelDia(hora: string): number {
    const [horas, minutos] = hora.split(":");
    return Number(horas) * MINUTOS_POR_HORA + Number(minutos);
  }

  public static horaCorta(hora: string): string {
    return hora.slice(0, 5);
  }

  public static instante(fecha: string, hora: string): Date {
    return new Date(`${fecha}T${Calendario.horaCorta(hora)}:00${config.zonaHoraria.offset}`);
  }

  public static fechaLocal(instante: Date): string {
    const local = new Date(instante.getTime() + offsetEnMinutos() * MS_POR_MINUTO);
    return `${local.getUTCFullYear()}-${dosDigitos(local.getUTCMonth() + 1)}-${dosDigitos(local.getUTCDate())}`;
  }

  public static horaLocal(instante: Date): string {
    const local = new Date(instante.getTime() + offsetEnMinutos() * MS_POR_MINUTO);
    return `${dosDigitos(local.getUTCHours())}:${dosDigitos(local.getUTCMinutes())}`;
  }

  public static sumarDias(fecha: string, dias: number): string {
    const base = new Date(`${fecha}T00:00:00Z`);
    return new Date(base.getTime() + dias * MS_POR_DIA).toISOString().slice(0, 10);
  }

  public static diasEntre(desde: string, hasta: string): number {
    return Math.round((new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / MS_POR_DIA);
  }

  public static minutosDeOperacion(horario: HorarioZona): number {
    return Calendario.minutosDelDia(horario.horaCierre) - Calendario.minutosDelDia(horario.horaApertura);
  }

  public static ultimaFranjaIncompleta(horario: HorarioZona): boolean {
    return Calendario.minutosDeOperacion(horario) % horario.duracionFranjaMinutos !== 0;
  }

  public static franjasDelDia(horario: HorarioZona, fecha: string): Franja[] {
    const apertura = Calendario.instante(fecha, horario.horaApertura).getTime();
    const cierre = Calendario.instante(fecha, horario.horaCierre).getTime();
    const duracion = horario.duracionFranjaMinutos * MS_POR_MINUTO;
    const franjas: Franja[] = [];

    for (let inicio = apertura; inicio < cierre; inicio += duracion) {
      franjas.push({ inicio: new Date(inicio), fin: new Date(Math.min(inicio + duracion, cierre)) });
    }

    return franjas;
  }

  public static franjaQueIniciaA(horario: HorarioZona, fecha: string, horaInicio: string): Franja | undefined {
    const inicio = Calendario.instante(fecha, horaInicio).getTime();
    return Calendario.franjasDelDia(horario, fecha).find((franja) => franja.inicio.getTime() === inicio);
  }
}

export default Calendario;
