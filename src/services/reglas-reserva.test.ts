import { describe, expect, it } from "vitest";
import type DomainError from "../lib/domain-error";
import ReglasReserva, { type ContextoReserva } from "./reglas-reserva";

const ahora = new Date("2030-05-01T12:00:00-05:00");

function contexto(overrides: Partial<ContextoReserva> = {}): ContextoReserva {
  return {
    zona: { activa: true, anticipacionMinimaHoras: 24, anticipacionMaximaDias: 30 },
    franja: { inicio: new Date("2030-05-03T08:00:00-05:00"), fin: new Date("2030-05-03T10:00:00-05:00") },
    ahora,
    bloqueos: [],
    reservasActivasDelApartamento: 0,
    maxReservasActivas: 2,
    pazYSalvo: true,
    ...overrides,
  };
}

function codigoDe(error: DomainError | null): string | undefined {
  return error?.code;
}

describe("ReglasReserva", () => {
  it("acepta una reserva que cumple todas las reglas", () => {
    expect(() => ReglasReserva.validar(contexto())).not.toThrow();
  });

  it("rechaza una zona inactiva", () => {
    expect(codigoDe(ReglasReserva.zonaActiva(contexto({ zona: { activa: false, anticipacionMinimaHoras: 0, anticipacionMaximaDias: 30 } })))).toBe(
      "ZONA_INACTIVA",
    );
  });

  it("rechaza una franja bloqueada por mantenimiento e informa el motivo", () => {
    const error = ReglasReserva.franjaSinBloqueo(
      contexto({ bloqueos: [{ inicio: new Date("2030-05-03T00:00:00-05:00"), fin: new Date("2030-05-04T00:00:00-05:00"), motivo: "Pintura" }] }),
    );
    expect(error?.code).toBe("FRANJA_BLOQUEADA");
    expect(error?.details).toEqual({ motivo: "Pintura" });
  });

  it("rechaza reservar con menos de la anticipacion minima", () => {
    const franja = { inicio: new Date("2030-05-01T14:00:00-05:00"), fin: new Date("2030-05-01T16:00:00-05:00") };
    expect(codigoDe(ReglasReserva.anticipacion(contexto({ franja })))).toBe("ANTICIPACION_MINIMA");
  });

  it("rechaza reservar con mas de la anticipacion maxima", () => {
    const franja = { inicio: new Date("2030-06-15T08:00:00-05:00"), fin: new Date("2030-06-15T10:00:00-05:00") };
    expect(codigoDe(ReglasReserva.anticipacion(contexto({ franja })))).toBe("ANTICIPACION_MAXIMA");
  });

  it("rechaza una franja que ya comenzo", () => {
    const franja = { inicio: new Date("2030-05-01T11:00:00-05:00"), fin: new Date("2030-05-01T13:00:00-05:00") };
    expect(codigoDe(ReglasReserva.anticipacion(contexto({ franja })))).toBe("FRANJA_PASADA");
  });

  it("rechaza una tercera reserva activa del apartamento", () => {
    expect(codigoDe(ReglasReserva.limiteDeReservasActivas(contexto({ reservasActivasDelApartamento: 2 })))).toBe("LIMITE_RESERVAS_ACTIVAS");
    expect(ReglasReserva.limiteDeReservasActivas(contexto({ reservasActivasDelApartamento: 1 }))).toBeNull();
  });

  it("rechaza un apartamento que no esta a paz y salvo", () => {
    expect(codigoDe(ReglasReserva.pazYSalvo(contexto({ pazYSalvo: false })))).toBe("SIN_PAZ_Y_SALVO");
  });

  it("reporta con 422 la primera regla incumplida", () => {
    try {
      ReglasReserva.validar(contexto({ pazYSalvo: false, reservasActivasDelApartamento: 5 }));
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).statusCode).toBe(422);
      expect((error as DomainError).code).toBe("LIMITE_RESERVAS_ACTIVAS");
    }
  });
});
