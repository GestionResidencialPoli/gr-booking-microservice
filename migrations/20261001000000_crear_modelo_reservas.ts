import type { Knex } from "knex";

const ESTADOS_RESERVA = ["CONFIRMADA", "CANCELADA"];
const TIPOS_CANCELACION = ["RESIDENTE", "ADMINISTRACION", "MANTENIMIENTO"];

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS btree_gist");

  await knex.schema.createTable("zonas_comunes", (table) => {
    table.bigIncrements("id").primary();
    table.string("nombre", 100).notNullable();
    table.string("descripcion", 500).nullable();
    table.time("hora_apertura").notNullable();
    table.time("hora_cierre").notNullable();
    table.integer("duracion_franja_minutos").notNullable();
    table.integer("aforo").notNullable().defaultTo(1);
    table.integer("anticipacion_minima_horas").notNullable().defaultTo(0);
    table.integer("anticipacion_maxima_dias").notNullable().defaultTo(30);
    table.integer("anticipacion_cancelacion_horas").notNullable().defaultTo(0);
    table.boolean("activa").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check("hora_cierre > hora_apertura", [], "ck_zonas_comunes_horario");
    table.check("duracion_franja_minutos BETWEEN 15 AND 1440", [], "ck_zonas_comunes_duracion_franja");
    table.check("aforo >= 1", [], "ck_zonas_comunes_aforo");
    table.check(
      "anticipacion_minima_horas >= 0 AND anticipacion_maxima_dias >= 1 AND anticipacion_cancelacion_horas >= 0",
      [],
      "ck_zonas_comunes_anticipacion",
    );
  });

  await knex.raw("CREATE UNIQUE INDEX ux_zonas_comunes_nombre ON zonas_comunes (lower(nombre))");

  await knex.schema.createTable("bloqueos_mantenimiento", (table) => {
    table.bigIncrements("id").primary();
    table
      .bigInteger("zona_id")
      .notNullable()
      .references("id")
      .inTable("zonas_comunes")
      .onDelete("RESTRICT")
      .withKeyName("fk_bloqueos_zona");
    table.timestamp("inicio", { useTz: true }).notNullable();
    table.timestamp("fin", { useTz: true }).notNullable();
    table.string("motivo", 300).notNullable();
    table.bigInteger("creado_por_user_id").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("eliminado_en", { useTz: true }).nullable();
    table.bigInteger("eliminado_por_user_id").nullable();

    table.check("fin > inicio", [], "ck_bloqueos_rango");
    table.check("(eliminado_en IS NULL) = (eliminado_por_user_id IS NULL)", [], "ck_bloqueos_eliminacion");
  });

  await knex.raw(`
    CREATE INDEX idx_bloqueos_vigentes_rango
    ON bloqueos_mantenimiento USING gist (zona_id, tstzrange(inicio, fin))
    WHERE eliminado_en IS NULL
  `);

  await knex.schema.createTable("franjas_ocupacion", (table) => {
    table
      .bigInteger("zona_id")
      .notNullable()
      .references("id")
      .inTable("zonas_comunes")
      .onDelete("RESTRICT")
      .withKeyName("fk_franjas_zona");
    table.timestamp("inicio", { useTz: true }).notNullable();
    table.timestamp("fin", { useTz: true }).notNullable();
    table.integer("aforo").notNullable();
    table.integer("ocupados").notNullable().defaultTo(0);

    table.primary(["zona_id", "inicio"], { constraintName: "pk_franjas_ocupacion" });
    table.check("fin > inicio", [], "ck_franjas_rango");
    table.check("aforo >= 1", [], "ck_franjas_aforo");
    table.check("ocupados >= 0 AND ocupados <= aforo", [], "ck_franjas_ocupados");
  });

  await knex.schema.createTable("reservas", (table) => {
    table.bigIncrements("id").primary();
    table.bigInteger("zona_id").notNullable();
    table.bigInteger("apartamento_id").notNullable();
    table.string("apartamento_torre", 20).notNullable();
    table.string("apartamento_numero", 20).notNullable();
    table.bigInteger("residente_user_id").notNullable();
    table.string("residente_nombre", 200).notNullable();
    table.timestamp("inicio", { useTz: true }).notNullable();
    table.timestamp("fin", { useTz: true }).notNullable();
    table.string("estado", 20).notNullable().defaultTo("CONFIRMADA");
    table.boolean("exclusiva").notNullable();
    table.timestamp("cancelada_en", { useTz: true }).nullable();
    table.bigInteger("cancelada_por_user_id").nullable();
    table.string("cancelacion_tipo", 20).nullable();
    table.string("cancelacion_motivo", 300).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table
      .foreign(["zona_id", "inicio"], "fk_reservas_franja")
      .references(["zona_id", "inicio"])
      .inTable("franjas_ocupacion")
      .onDelete("RESTRICT");
    table.check("fin > inicio", [], "ck_reservas_rango");
    table.check("?? = ANY (?)", ["estado", ESTADOS_RESERVA], "ck_reservas_estado");
    table.check("cancelacion_tipo IS NULL OR ?? = ANY (?)", ["cancelacion_tipo", TIPOS_CANCELACION], "ck_reservas_cancelacion_tipo");
    table.check(
      "(estado = 'CANCELADA') = (cancelada_en IS NOT NULL AND cancelada_por_user_id IS NOT NULL AND cancelacion_tipo IS NOT NULL)",
      [],
      "ck_reservas_cancelacion",
    );
  });

  await knex.raw(`
    ALTER TABLE reservas
    ADD CONSTRAINT ex_reservas_exclusivas_sin_solapamiento
    EXCLUDE USING gist (zona_id WITH =, tstzrange(inicio, fin) WITH &&)
    WHERE (estado = 'CONFIRMADA' AND exclusiva)
  `);

  await knex.raw("CREATE INDEX idx_reservas_zona_rango ON reservas (zona_id, inicio, fin)");
  await knex.raw("CREATE INDEX idx_reservas_apartamento_inicio ON reservas (apartamento_id, inicio)");
  await knex.raw("CREATE INDEX idx_reservas_inicio ON reservas (inicio)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("reservas");
  await knex.schema.dropTable("franjas_ocupacion");
  await knex.schema.dropTable("bloqueos_mantenimiento");
  await knex.schema.dropTable("zonas_comunes");
}
