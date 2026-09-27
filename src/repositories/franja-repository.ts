import type { Knex } from "knex";

const TABLE = "franjas_ocupacion";

class FranjaRepository {
  public static async actualizarAforoFuturo(trx: Knex.Transaction, zonaId: number, aforo: number): Promise<void> {
    await trx(TABLE).where({ zona_id: zonaId }).andWhere("fin", ">", trx.fn.now()).update({ aforo });
  }
}

export default FranjaRepository;
