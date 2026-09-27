import type { Knex } from "knex";
import EstadoCarteraRepository from "../../repositories/estado-cartera-repository";
import type { ConsultaPazYSalvo } from "./consulta-paz-y-salvo";

const carteraReplicada: ConsultaPazYSalvo = {
  async estaAPazYSalvo(apartamentoId: number, trx: Knex.Transaction): Promise<boolean> {
    const estado = await EstadoCarteraRepository.findByApartamento(apartamentoId, trx);
    return !estado || Number(estado.saldo_vencido) === 0;
  },
};

export default carteraReplicada;
