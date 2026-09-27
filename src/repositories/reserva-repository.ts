import type { Knex } from "knex";
import knex from "../db/knex";
import type { ReservaRow } from "../types/components/reserva";

const TABLE = "reservas";

function conZona(trx: Knex | Knex.Transaction) {
  return trx<ReservaRow>(`${TABLE} as r`)
    .join("zonas_comunes as z", "z.id", "r.zona_id")
    .select("r.*", "z.nombre as zona_nombre");
}

export interface NuevaReserva {
  zonaId: number;
  apartamento: { id: number; torre: string; numero: string };
  residente: { userId: number; nombre: string };
  inicio: Date;
  fin: Date;
  exclusiva: boolean;
}

class ReservaRepository {
  public static async insert(trx: Knex.Transaction, reserva: NuevaReserva): Promise<number> {
    const [fila] = await trx(TABLE)
      .insert({
        zona_id: reserva.zonaId,
        apartamento_id: reserva.apartamento.id,
        apartamento_torre: reserva.apartamento.torre,
        apartamento_numero: reserva.apartamento.numero,
        residente_user_id: reserva.residente.userId,
        residente_nombre: reserva.residente.nombre,
        inicio: reserva.inicio,
        fin: reserva.fin,
        exclusiva: reserva.exclusiva,
      })
      .returning("id");
    return Number(fila.id);
  }

  public static async contarActivasFuturas(trx: Knex.Transaction, apartamentoId: number, ahora: Date): Promise<number> {
    const [fila] = await trx(TABLE)
      .where({ apartamento_id: apartamentoId, estado: "CONFIRMADA" })
      .andWhere("inicio", ">", ahora)
      .count<{ count: string }[]>({ count: "*" });
    return Number(fila?.count ?? 0);
  }

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
