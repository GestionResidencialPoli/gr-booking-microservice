import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";

let secuencia = 0;

async function crearZona(aforo: number): Promise<number> {
  secuencia += 1;
  const [zona] = await knex("zonas_comunes")
    .insert({
      nombre: `Zona modelo ${secuencia}`,
      hora_apertura: "08:00",
      hora_cierre: "22:00",
      duracion_franja_minutos: 120,
      aforo,
    })
    .returning("id");
  return Number(zona.id);
}

async function crearFranja(zonaId: number, inicio: string, fin: string, aforo: number, ocupados = 0) {
  await knex("franjas_ocupacion").insert({ zona_id: zonaId, inicio, fin, aforo, ocupados });
}

function reserva(zonaId: number, inicio: string, fin: string, exclusiva: boolean, apartamentoId: number) {
  return {
    zona_id: zonaId,
    apartamento_id: apartamentoId,
    apartamento_torre: "A",
    apartamento_numero: String(apartamentoId),
    residente_user_id: apartamentoId,
    residente_nombre: "Residente de prueba",
    inicio,
    fin,
    exclusiva,
  };
}

async function codigoDeError(operacion: Promise<unknown>): Promise<string | undefined> {
  try {
    await operacion;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("modelo de datos de zonas y reservas", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("habilita btree_gist por migracion", async () => {
    const { rows } = await knex.raw("SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'");
    expect(rows).toHaveLength(1);
  });

  it("rechaza por SQL directo dos reservas exclusivas solapadas en la misma zona", async () => {
    const zonaId = await crearZona(1);
    await crearFranja(zonaId, "2030-01-10T08:00:00-05:00", "2030-01-10T10:00:00-05:00", 1);
    await crearFranja(zonaId, "2030-01-10T09:00:00-05:00", "2030-01-10T11:00:00-05:00", 1);
    await knex("reservas").insert(reserva(zonaId, "2030-01-10T08:00:00-05:00", "2030-01-10T10:00:00-05:00", true, 1));

    const codigo = await codigoDeError(
      knex("reservas").insert(reserva(zonaId, "2030-01-10T09:00:00-05:00", "2030-01-10T11:00:00-05:00", true, 2)),
    );

    expect(codigo).toBe("23P01");
  });

  it("permite reservas solapadas cuando la zona admite varios grupos o la anterior fue cancelada", async () => {
    const compartida = await crearZona(3);
    await crearFranja(compartida, "2030-01-11T08:00:00-05:00", "2030-01-11T10:00:00-05:00", 3);
    await knex("reservas").insert(reserva(compartida, "2030-01-11T08:00:00-05:00", "2030-01-11T10:00:00-05:00", false, 1));
    await knex("reservas").insert(reserva(compartida, "2030-01-11T08:00:00-05:00", "2030-01-11T10:00:00-05:00", false, 2));

    const exclusiva = await crearZona(1);
    await crearFranja(exclusiva, "2030-01-11T08:00:00-05:00", "2030-01-11T10:00:00-05:00", 1);
    const [cancelada] = await knex("reservas")
      .insert(reserva(exclusiva, "2030-01-11T08:00:00-05:00", "2030-01-11T10:00:00-05:00", true, 3))
      .returning("id");
    await knex("reservas").where({ id: cancelada.id }).update({
      estado: "CANCELADA",
      cancelada_en: knex.fn.now(),
      cancelada_por_user_id: 3,
      cancelacion_tipo: "RESIDENTE",
    });

    await expect(
      knex("reservas").insert(reserva(exclusiva, "2030-01-11T08:00:00-05:00", "2030-01-11T10:00:00-05:00", true, 4)),
    ).resolves.toBeDefined();
  });

  it("impide que el contador de una franja supere su aforo o quede negativo", async () => {
    const zonaId = await crearZona(2);
    await crearFranja(zonaId, "2030-01-12T08:00:00-05:00", "2030-01-12T10:00:00-05:00", 2, 2);
    const franja = knex("franjas_ocupacion").where({ zona_id: zonaId, inicio: "2030-01-12T08:00:00-05:00" });

    expect(await codigoDeError(franja.clone().update({ ocupados: 3 }))).toBe("23514");
    expect(await codigoDeError(franja.clone().update({ ocupados: -1 }))).toBe("23514");
  });

  it("exige que toda reserva pertenezca a una franja contabilizada", async () => {
    const zonaId = await crearZona(1);

    const codigo = await codigoDeError(
      knex("reservas").insert(reserva(zonaId, "2030-01-13T08:00:00-05:00", "2030-01-13T10:00:00-05:00", true, 1)),
    );

    expect(codigo).toBe("23503");
  });

  it("rechaza una zona con cierre anterior a la apertura", async () => {
    const codigo = await codigoDeError(
      knex("zonas_comunes").insert({
        nombre: "Zona invalida",
        hora_apertura: "20:00",
        hora_cierre: "08:00",
        duracion_franja_minutos: 60,
      }),
    );

    expect(codigo).toBe("23514");
  });

  it("resuelve la consulta de solapamiento con indice y no con un recorrido completo", async () => {
    const zonaId = await crearZona(1);

    const plan = await knex.transaction(async (trx) => {
      await trx.raw("SET LOCAL enable_seqscan = off");
      const { rows } = await trx.raw(
        `EXPLAIN SELECT id FROM reservas
         WHERE zona_id = ? AND inicio < ? AND fin > ? AND estado = 'CONFIRMADA'`,
        [zonaId, "2030-01-14T12:00:00-05:00", "2030-01-14T08:00:00-05:00"],
      );
      return rows.map((row: { "QUERY PLAN": string }) => row["QUERY PLAN"]).join("\n");
    });

    expect(plan).toMatch(/Index|Bitmap/);
    expect(plan).not.toMatch(/Seq Scan on reservas/);
  });
});
