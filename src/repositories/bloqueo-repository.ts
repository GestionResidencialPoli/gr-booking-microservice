import type { Knex } from "knex";
import knex from "../db/knex";
import type { BloqueoRow } from "../types/components/bloqueo";

const TABLE = "bloqueos_mantenimiento";

export interface NuevoBloqueo {
  zonaId: number;
  inicio: Date;
  fin: Date;
  motivo: string;
  creadoPorUserId: number;
}

class BloqueoRepository {
  public static async insert(trx: Knex.Transaction, bloqueo: NuevoBloqueo): Promise<BloqueoRow> {
    const [row] = await trx<BloqueoRow>(TABLE)
      .insert({
        zona_id: String(bloqueo.zonaId),
        inicio: bloqueo.inicio,
        fin: bloqueo.fin,
        motivo: bloqueo.motivo,
        creado_por_user_id: String(bloqueo.creadoPorUserId),
      })
      .returning("*");
    return row as BloqueoRow;
  }

  public static async findVigentesDeZona(zonaId: number): Promise<BloqueoRow[]> {
    return knex<BloqueoRow>(TABLE).where("zona_id", zonaId).whereNull("eliminado_en").orderBy("inicio");
  }

  public static async eliminar(zonaId: number, bloqueoId: number, porUserId: number): Promise<BloqueoRow | undefined> {
    const [row] = await knex<BloqueoRow>(TABLE)
      .where("id", bloqueoId)
      .andWhere("zona_id", zonaId)
      .whereNull("eliminado_en")
      .update({ eliminado_en: knex.fn.now(), eliminado_por_user_id: String(porUserId) })
      .returning("*");
    return row;
  }

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
