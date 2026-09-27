import Calendario from "../lib/calendario";
import DomainError from "../lib/domain-error";
import BloqueoRepository from "../repositories/bloqueo-repository";
import FranjaRepository from "../repositories/franja-repository";
import ZonaService from "./zona-service";
import DisponibilidadCalculator from "./disponibilidad-calculator";
import type { DisponibilidadDto } from "../types/components/disponibilidad";
import HttpStatus from "../types/enums/http-status";

export const MAX_DIAS_CONSULTA = 60;

interface ConsultaDisponibilidad {
  zonaId: number;
  desde: string;
  hasta: string;
  puedeVerInactivas: boolean;
  ahora?: Date;
}

class DisponibilidadService {
  public static async consultar(consulta: ConsultaDisponibilidad): Promise<DisponibilidadDto> {
    const dias = Calendario.diasEntre(consulta.desde, consulta.hasta) + 1;
    if (dias < 1) {
      throw new DomainError(HttpStatus.UnprocessableEntity, "RANGO_INVALIDO", "La fecha final no puede ser anterior a la inicial.");
    }
    if (dias > MAX_DIAS_CONSULTA) {
      throw new DomainError(
        HttpStatus.UnprocessableEntity,
        "RANGO_DEMASIADO_AMPLIO",
        `La consulta de disponibilidad admite como maximo ${MAX_DIAS_CONSULTA} dias.`,
      );
    }

    const zona = await ZonaService.obtener(consulta.zonaId, consulta.puedeVerInactivas);
    const ahora = consulta.ahora ?? new Date();
    const desde = Calendario.instante(consulta.desde, "00:00");
    const hasta = Calendario.instante(Calendario.sumarDias(consulta.hasta, 1), "00:00");

    const [ocupacion, bloqueos] = await Promise.all([
      FranjaRepository.findEnRango(zona.id, desde, hasta),
      BloqueoRepository.findVigentesEnRango(zona.id, desde, hasta),
    ]);
    const ocupacionPorInicio = new Map(ocupacion.map((franja) => [franja.inicio.getTime(), franja]));

    return {
      zonaId: zona.id,
      desde: consulta.desde,
      hasta: consulta.hasta,
      consultadaEn: ahora.toISOString(),
      dias: Array.from({ length: dias }, (_, indice) => {
        const fecha = Calendario.sumarDias(consulta.desde, indice);
        return {
          fecha,
          franjas: Calendario.franjasDelDia(zona, fecha).map((franja) => {
            const registrada = ocupacionPorInicio.get(franja.inicio.getTime());
            const aforo = registrada?.aforo ?? zona.aforo;
            const calculado = DisponibilidadCalculator.estado(franja, aforo, registrada?.ocupados ?? 0, bloqueos, zona, ahora);
            return {
              inicio: franja.inicio.toISOString(),
              fin: franja.fin.toISOString(),
              horaInicio: Calendario.horaLocal(franja.inicio),
              horaFin: Calendario.horaLocal(franja.fin),
              aforo,
              ...calculado,
            };
          }),
        };
      }),
    };
  }
}

export default DisponibilidadService;
