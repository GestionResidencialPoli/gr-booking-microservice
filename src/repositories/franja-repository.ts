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

  public static async asegurar(trx: Knex.Transaction, zonaId: number, inicio: Date, fin: Date, aforo: number): Promise<void> {
    await trx(TABLE)
      .insert({ zona_id: zonaId, inicio, fin, aforo, ocupados: 0 })
      .onConflict(["zona_id", "inicio"])
      .ignore();
  }

  public static async tomarCupo(trx: Knex.Transaction, zonaId: number, inicio: Date): Promise<FranjaOcupacionRow | undefined> {
    const [row] = await trx<FranjaOcupacionRow>(TABLE)
      .where("zona_id", zonaId)
      .andWhere("inicio", inicio)
      .andWhereRaw("ocupados < aforo")
      .update({ ocupados: trx.raw("ocupados + 1") })
      .returning("*");
    return row;
  }

  public static async liberarCupo(trx: Knex.Transaction, zonaId: number, inicio: Date): Promise<void> {
    await trx(TABLE).where({ zona_id: zonaId, inicio }).decrement("ocupados", 1);
  }

  public static async findEnRango(zonaId: number, desde: Date, hasta: Date): Promise<FranjaOcupacionRow[]> {
    return knex<FranjaOcupacionRow>(TABLE)
      .where("zona_id", zonaId)
      .andWhere("inicio", ">=", desde)
      .andWhere("inicio", "<", hasta);
  }
}

export default FranjaRepository;
