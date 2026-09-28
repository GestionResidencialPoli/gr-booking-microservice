import { describe, expect, it } from "vitest";
import BloqueoValidator from "./bloqueo-validator";

const base = { inicio: "2030-09-10T00:00", fin: "2030-09-16T00:00", motivo: "Mantenimiento" };

describe("BloqueoValidator", () => {
  it("acepta un rango con fechas reales", () => {
    expect(BloqueoValidator.bloqueo(base)).toMatchObject({ inicio: "2030-09-10T00:00", cancelarReservasAfectadas: false });
  });

  it.each(["2030-13-01T00:00", "2030-02-30T08:00", "2030-04-31T10:00", "2030-09-10T24:00", "2030-09-10 08:00"])(
    "rechaza la fecha %s",
    (inicio) => {
      expect(() => BloqueoValidator.bloqueo({ ...base, inicio })).toThrow();
    },
  );

  it("acepta el 29 de febrero de un anio bisiesto", () => {
    expect(() => BloqueoValidator.bloqueo({ ...base, inicio: "2032-02-29T08:00" })).not.toThrow();
  });

  it("exige un motivo con contenido", () => {
    expect(() => BloqueoValidator.bloqueo({ ...base, motivo: "   " })).toThrow();
  });
});
