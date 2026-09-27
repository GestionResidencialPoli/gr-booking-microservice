import type { Knex } from "knex";
import knex from "../db/knex";

const TABLE = "franjas_ocupacion";

export interface FranjaOcupacionRow {
  zona_id: string;
  inicio: Date;
  fin: Date;
  aforo: number;
  ocupados: number;
}

class FranjaRepository {
  public static async actualizarAforoFuturo(trx: Knex.Transaction, zonaId: number, aforo: number): Promise<void> {
    await trx(TABLE).where({ zona_id: zonaId }).andWhere("fin", ">", trx.fn.now()).update({ aforo });
  }

  public static async findEnRango(zonaId: number, desde: Date, hasta: Date): Promise<FranjaOcupacionRow[]> {
    return knex<FranjaOcupacionRow>(TABLE)
      .where("zona_id", zonaId)
      .andWhere("inicio", ">=", desde)
      .andWhere("inicio", "<", hasta);
  }
}

export default FranjaRepository;
