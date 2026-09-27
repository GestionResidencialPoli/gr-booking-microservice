import { afterAll, describe, expect, it } from "vitest";
import knex from "../../src/db/knex";
import { seed } from "../../seeds/01_zonas_comunes";

describe("datos semilla de zonas comunes", () => {
  afterAll(async () => {
    await knex.destroy();
  });

  it("carga al menos cuatro zonas con parametros diferentes y es idempotente", async () => {
    await seed(knex);
    await seed(knex);

    const zonas = await knex("zonas_comunes")
      .whereIn("nombre", ["Salon Social", "Piscina", "Cancha Multiple", "Zona BBQ"])
      .select("nombre", "duracion_franja_minutos", "aforo");

    expect(zonas).toHaveLength(4);
    expect(new Set(zonas.map((zona) => `${zona.duracion_franja_minutos}-${zona.aforo}`)).size).toBe(4);
  });
});
