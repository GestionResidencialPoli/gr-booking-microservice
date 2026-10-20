import { z } from "zod";
import Calendario from "../lib/calendario";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:MM.");

export const zonaComunSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(100, "El nombre supera los 100 caracteres."),
  descripcion: z.string().trim().max(500, "La descripcion supera los 500 caracteres.").nullable().optional(),
  horaApertura: hora,
  horaCierre: hora,
  duracionFranjaMinutos: z.number().int().min(15).max(1440),
  aforo: z.number().int().min(1).max(500).default(1),
  anticipacionMinimaHoras: z.number().int().min(0).max(8760).default(0),
  anticipacionMaximaDias: z.number().int().min(1).max(365).default(30),
  anticipacionCancelacionHoras: z.number().int().min(0).max(8760).default(0),
  confirmarFranjaIncompleta: z.boolean().default(false),
});

export const activacionSchema = z.object({
  activa: z.boolean(),
});

export const listarZonasQuerySchema = z.object({
  incluirInactivas: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
});

export const idSchema = z.coerce.number().int().positive();

const DIAS_POR_DEFECTO = 6;

export const disponibilidadQuerySchema = z
  .object({
    desde: z.string().date("La fecha desde debe tener el formato YYYY-MM-DD.").optional(),
    hasta: z.string().date("La fecha hasta debe tener el formato YYYY-MM-DD.").optional(),
  })
  .transform(({ desde, hasta }) => {
    const inicio = desde ?? Calendario.fechaLocal(new Date());
    return { desde: inicio, hasta: hasta ?? Calendario.sumarDias(inicio, DIAS_POR_DEFECTO) };
  });

class ZonaValidator {
  public static zona(input: unknown) {
    return zonaComunSchema.parse(input);
  }

  public static activacion(input: unknown) {
    return activacionSchema.parse(input);
  }

  public static listarQuery(input: unknown) {
    return listarZonasQuerySchema.parse(input);
  }

  public static disponibilidadQuery(input: unknown) {
    return disponibilidadQuerySchema.parse(input);
  }

  public static id(input: unknown) {
    return idSchema.parse(input);
  }
}

export default ZonaValidator;
