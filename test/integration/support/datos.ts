import knex from "../../../src/db/knex";

let secuencia = 0;

export function nombreUnico(prefijo: string): string {
  secuencia += 1;
  return `${prefijo} ${process.pid}-${secuencia}`;
}

export function zonaPayload(overrides: Record<string, unknown> = {}) {
  return {
    nombre: nombreUnico("Zona"),
    descripcion: "Zona de prueba",
    horaApertura: "08:00",
    horaCierre: "20:00",
    duracionFranjaMinutos: 120,
    aforo: 1,
    anticipacionMinimaHoras: 0,
    anticipacionMaximaDias: 60,
    anticipacionCancelacionHoras: 0,
    ...overrides,
  };
}

export async function insertarReservaConfirmada(
  zonaId: number,
  inicio: Date,
  fin: Date,
  apartamentoId: number,
  aforo = 1,
): Promise<number> {
  await knex("franjas_ocupacion")
    .insert({ zona_id: zonaId, inicio, fin, aforo, ocupados: 0 })
    .onConflict(["zona_id", "inicio"])
    .ignore();
  await knex("franjas_ocupacion").where({ zona_id: zonaId, inicio }).increment("ocupados", 1);
  const [fila] = await knex("reservas")
    .insert({
      zona_id: zonaId,
      apartamento_id: apartamentoId,
      apartamento_torre: "A",
      apartamento_numero: String(apartamentoId),
      residente_user_id: apartamentoId,
      residente_nombre: `Residente ${apartamentoId}`,
      inicio,
      fin,
      exclusiva: aforo === 1,
    })
    .returning("id");
  return Number(fila.id);
}

export function enDias(dias: number, hora = "10:00"): Date {
  const fecha = new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${fecha}T${hora}:00-05:00`);
}
