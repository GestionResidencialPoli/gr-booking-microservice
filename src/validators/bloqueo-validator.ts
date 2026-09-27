import { z } from "zod";

const fechaHoraLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Debe tener el formato YYYY-MM-DDTHH:MM en hora local.");

export const bloqueoSchema = z.object({
  inicio: fechaHoraLocal,
  fin: fechaHoraLocal,
  motivo: z.string().trim().min(3, "El motivo del bloqueo es obligatorio.").max(300),
  cancelarReservasAfectadas: z.boolean().default(false),
});

export const rangoSchema = z.object({
  inicio: fechaHoraLocal,
  fin: fechaHoraLocal,
});

class BloqueoValidator {
  public static bloqueo(input: unknown) {
    return bloqueoSchema.parse(input);
  }

  public static rango(input: unknown) {
    return rangoSchema.parse(input);
  }
}

export default BloqueoValidator;
