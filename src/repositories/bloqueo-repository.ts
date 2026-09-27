import type { Knex } from "knex";
import knex from "../db/knex";
import type { BloqueoRow } from "../types/components/bloqueo";

const TABLE = "bloqueos_mantenimiento";

class BloqueoRepository {
  public static async findVigentesEnRango(
    zonaId: number,
    desde: Date,
    hasta: Date,
    trx: Knex | Knex.Transaction = knex,
  ): Promise<BloqueoRow[]> {
    return trx<BloqueoRow>(TABLE)
      .where("zona_id", zonaId)
      .whereNull("eliminado_en")
      .andWhere("inicio", "<", hasta)
      .andWhere("fin", ">", desde)
      .orderBy("inicio");
  }
}

export default BloqueoRepository;
