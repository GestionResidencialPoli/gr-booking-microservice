import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("estado_cartera", (table) => {
    table.bigInteger("apartamento_id").primary();
    table.decimal("saldo_vencido", 14, 2).notNullable().defaultTo(0);
    table.timestamp("fuente_actualizada_en", { useTz: true }).notNullable();
    table.timestamp("replicado_en", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check("saldo_vencido >= 0", [], "ck_estado_cartera_saldo");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("estado_cartera");
}
