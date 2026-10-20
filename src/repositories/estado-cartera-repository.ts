import type { Knex } from "knex";
import knex from "../db/knex";

const TABLE = "estado_cartera";

export interface EstadoCarteraRow {
  apartamento_id: string;
  saldo_vencido: string;
  fuente_actualizada_en: Date;
  replicado_en: Date;
}

export interface EstadoCarteraEvento {
  apartamentoId: number;
  saldoVencido: number;
  actualizadoEn: Date;
}

class EstadoCarteraRepository {
  public static async findByApartamento(apartamentoId: number, trx: Knex | Knex.Transaction = knex): Promise<EstadoCarteraRow | undefined> {
    return trx<EstadoCarteraRow>(TABLE).where("apartamento_id", apartamentoId).first();
  }

  public static async aplicarSiEsMasReciente(evento: EstadoCarteraEvento): Promise<boolean> {
    const { rowCount } = await knex.raw(
      `INSERT INTO ${TABLE} (apartamento_id, saldo_vencido, fuente_actualizada_en, replicado_en)
       VALUES (?, ?, ?, now())
       ON CONFLICT (apartamento_id) DO UPDATE
       SET saldo_vencido = EXCLUDED.saldo_vencido,
           fuente_actualizada_en = EXCLUDED.fuente_actualizada_en,
           replicado_en = now()
       WHERE ${TABLE}.fuente_actualizada_en <= EXCLUDED.fuente_actualizada_en`,
      [evento.apartamentoId, evento.saldoVencido, evento.actualizadoEn],
    );
    return rowCount === 1;
  }
}

export default EstadoCarteraRepository;
