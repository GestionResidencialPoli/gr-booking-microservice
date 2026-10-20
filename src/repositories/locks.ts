import type { Knex } from "knex";

const ESPACIO_APARTAMENTO = 1;

class Locks {
  public static async apartamento(trx: Knex.Transaction, apartamentoId: number): Promise<void> {
    await trx.raw("SELECT pg_advisory_xact_lock(?, ?::int)", [ESPACIO_APARTAMENTO, apartamentoId]);
  }
}

export default Locks;
