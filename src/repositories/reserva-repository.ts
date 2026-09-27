import type { Knex } from "knex";
import knex from "../db/knex";
import type { ReservaRow } from "../types/components/reserva";

const TABLE = "reservas";

function conZona(trx: Knex | Knex.Transaction) {
  return trx<ReservaRow>(`${TABLE} as r`)
    .join("zonas_comunes as z", "z.id", "r.zona_id")
    .select("r.*", "z.nombre as zona_nombre");
}

class ReservaRepository {
  public static async findFuturasConfirmadasDeZona(
    trx: Knex | Knex.Transaction,
    zonaId: number,
    desde: Date = new Date(),
  ): Promise<ReservaRow[]> {
    return conZona(trx)
      .where("r.zona_id", zonaId)
      .andWhere("r.estado", "CONFIRMADA")
      .andWhere("r.inicio", ">", desde)
      .orderBy("r.inicio");
  }

  public static async existenFuturasConfirmadas(trx: Knex.Transaction, zonaId: number): Promise<boolean> {
    const fila = await trx(TABLE)
      .where({ zona_id: zonaId, estado: "CONFIRMADA" })
      .andWhere("inicio", ">", trx.fn.now())
      .first("id");
    return Boolean(fila);
  }

  public static async findById(id: number, trx: Knex | Knex.Transaction = knex): Promise<ReservaRow | undefined> {
    return conZona(trx).where("r.id", id).first();
  }
}

export default ReservaRepository;
