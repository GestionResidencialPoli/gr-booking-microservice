import { describe, expect, it } from "vitest";
import Calendario from "./calendario";

const salonSocial = { horaApertura: "08:00", horaCierre: "22:00", duracionFranjaMinutos: 240 };
const cancha = { horaApertura: "08:00:00", horaCierre: "20:00:00", duracionFranjaMinutos: 120 };

describe("Calendario", () => {
  it("deriva 6 franjas de 120 minutos entre las 08:00 y las 20:00", () => {
    const franjas = Calendario.franjasDelDia(cancha, "2030-03-04");

    expect(franjas).toHaveLength(6);
    expect(Calendario.horaLocal(franjas[0]!.inicio)).toBe("08:00");
    expect(Calendario.horaLocal(franjas[5]!.fin)).toBe("20:00");
  });

  it("acorta la ultima franja cuando la duracion no cabe un numero entero de veces", () => {
    const franjas = Calendario.franjasDelDia(salonSocial, "2030-03-04");

    expect(Calendario.ultimaFranjaIncompleta(salonSocial)).toBe(true);
    expect(franjas.map((franja) => Calendario.horaLocal(franja.inicio))).toEqual(["08:00", "12:00", "16:00", "20:00"]);
    expect(Calendario.horaLocal(franjas[3]!.fin)).toBe("22:00");
  });

  it("interpreta las horas en la zona horaria de Colombia", () => {
    expect(Calendario.instante("2030-03-04", "08:00").toISOString()).toBe("2030-03-04T13:00:00.000Z");
    expect(Calendario.fechaLocal(new Date("2030-03-05T03:00:00Z"))).toBe("2030-03-04");
  });

  it("encuentra la franja que inicia a una hora dada y rechaza horas que no son inicio de franja", () => {
    expect(Calendario.franjaQueIniciaA(cancha, "2030-03-04", "10:00")).toBeDefined();
    expect(Calendario.franjaQueIniciaA(cancha, "2030-03-04", "11:00")).toBeUndefined();
  });

  it("calcula dias entre fechas y suma dias sin depender de la zona horaria del proceso", () => {
    expect(Calendario.diasEntre("2030-03-01", "2030-04-30")).toBe(60);
    expect(Calendario.sumarDias("2030-02-28", 1)).toBe("2030-03-01");
  });
});
