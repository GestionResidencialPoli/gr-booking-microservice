import { z } from "zod";

export const crearReservaSchema = z.object({
  zonaId: z.number().int().positive(),
  fecha: z.string().date("La fecha debe tener el formato YYYY-MM-DD."),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:MM."),
});

class ReservaValidator {
  public static crear(input: unknown) {
    return crearReservaSchema.parse(input);
  }
}

export default ReservaValidator;
