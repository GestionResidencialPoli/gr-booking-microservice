import type { Knex } from "knex";

export interface ConsultaPazYSalvo {
  estaAPazYSalvo(apartamentoId: number, trx: Knex.Transaction): Promise<boolean>;
}
