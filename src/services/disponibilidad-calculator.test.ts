import { describe, expect, it } from "vitest";
import DisponibilidadCalculator from "./disponibilidad-calculator";

const ahora = new Date("2030-05-01T12:00:00-05:00");
const reglas = { anticipacionMinimaHoras: 24, anticipacionMaximaDias: 30 };
const franja = { inicio: new Date("2030-05-03T08:00:00-05:00"), fin: new Date("2030-05-03T10:00:00-05:00") };

describe("DisponibilidadCalculator", () => {
  it("marca disponible una franja sin reservas dentro de la anticipacion", () => {
    expect(DisponibilidadCalculator.estado(franja, 3, 0, [], reglas, ahora)).toEqual({
      estado: "DISPONIBLE",
      cuposRestantes: 3,
      motivoBloqueo: null,
    });
  });

  it("marca parcial con 1 cupo restante una franja de aforo 3 con 2 reservas", () => {
    expect(DisponibilidadCalculator.estado(franja, 3, 2, [], reglas, ahora)).toMatchObject({ estado: "PARCIAL", cuposRestantes: 1 });
  });

  it("marca completa una franja con el aforo agotado", () => {
    expect(DisponibilidadCalculator.estado(franja, 1, 1, [], reglas, ahora).estado).toBe("COMPLETA");
  });

  it("marca bloqueada con el motivo una franja que toca un bloqueo por mantenimiento", () => {
    const bloqueo = { inicio: new Date("2030-05-03T09:00:00-05:00"), fin: new Date("2030-05-04T00:00:00-05:00"), motivo: "Pintura" };
    expect(DisponibilidadCalculator.estado(franja, 1, 0, [bloqueo], reglas, ahora)).toMatchObject({
      estado: "BLOQUEADA",
      motivoBloqueo: "Pintura",
    });
  });

  it("no considera bloqueada una franja que solo toca el borde del bloqueo", () => {
    const bloqueo = { inicio: new Date("2030-05-03T10:00:00-05:00"), fin: new Date("2030-05-03T12:00:00-05:00"), motivo: "x" };
    expect(DisponibilidadCalculator.estado(franja, 1, 0, [bloqueo], reglas, ahora).estado).toBe("DISPONIBLE");
  });

  it("marca fuera de anticipacion las franjas antes de la anticipacion minima o despues de la maxima", () => {
    const hoy = { inicio: new Date("2030-05-01T16:00:00-05:00"), fin: new Date("2030-05-01T18:00:00-05:00") };
    const lejana = { inicio: new Date("2030-06-15T08:00:00-05:00"), fin: new Date("2030-06-15T10:00:00-05:00") };

    expect(DisponibilidadCalculator.estado(hoy, 1, 0, [], reglas, ahora).estado).toBe("FUERA_DE_ANTICIPACION");
    expect(DisponibilidadCalculator.estado(lejana, 1, 0, [], reglas, ahora).estado).toBe("FUERA_DE_ANTICIPACION");
  });
});
