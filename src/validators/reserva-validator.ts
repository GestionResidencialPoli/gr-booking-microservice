import { z } from "zod";

export const crearReservaSchema = z.object({
  zonaId: z.number().int().positive(),
  fecha: z.string().date("La fecha debe tener el formato YYYY-MM-DD."),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:MM."),
});

export const filtroReservasSchema = z.object({
  zonaId: z.coerce.number().int().positive().optional(),
  desde: z.string().date().optional(),
  hasta: z.string().date().optional(),
  estado: z.enum(["CONFIRMADA", "CANCELADA"]).optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelacionAdministrativaSchema = z.object({
  motivo: z
    .string({ error: "El motivo de la cancelacion es obligatorio." })
    .trim()
    .min(3, "El motivo de la cancelacion es obligatorio.")
    .max(300, "El motivo supera los 300 caracteres."),
});

export const idSchema = z.coerce.number().int().positive();

class ReservaValidator {
  public static filtro(input: unknown) {
    return filtroReservasSchema.parse(input);
  }

  public static cancelacionAdministrativa(input: unknown) {
    return cancelacionAdministrativaSchema.parse(input);
  }

  public static id(input: unknown) {
    return idSchema.parse(input);
  }

  public static crear(input: unknown) {
    return crearReservaSchema.parse(input);
  }
}

export default ReservaValidator;
