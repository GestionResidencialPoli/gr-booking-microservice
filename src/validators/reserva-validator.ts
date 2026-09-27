import { z } from "zod";

export const crearReservaSchema = z.object({
  zonaId: z.number().int().positive(),
  fecha: z.string().date("La fecha debe tener el formato YYYY-MM-DD."),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:MM."),
});

export const idSchema = z.coerce.number().int().positive();

class ReservaValidator {
  public static id(input: unknown) {
    return idSchema.parse(input);
  }

  public static crear(input: unknown) {
    return crearReservaSchema.parse(input);
  }
}

export default ReservaValidator;
