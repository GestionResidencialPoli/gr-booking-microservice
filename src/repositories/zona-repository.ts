import type { Knex } from "knex";
import knex from "../db/knex";
import type { ZonaComunInput, ZonaComunRow } from "../types/components/zona";

const TABLE = "zonas_comunes";

function columnas(input: ZonaComunInput) {
  return {
    nombre: input.nombre,
    descripcion: input.descripcion ?? null,
    hora_apertura: input.horaApertura,
    hora_cierre: input.horaCierre,
    duracion_franja_minutos: input.duracionFranjaMinutos,
    aforo: input.aforo,
    anticipacion_minima_horas: input.anticipacionMinimaHoras,
    anticipacion_maxima_dias: input.anticipacionMaximaDias,
    anticipacion_cancelacion_horas: input.anticipacionCancelacionHoras,
  };
}

class ZonaRepository {
  public static async findAll(incluirInactivas: boolean): Promise<ZonaComunRow[]> {
    const query = knex<ZonaComunRow>(TABLE).orderBy("nombre");
    return incluirInactivas ? query : query.where("activa", true);
  }

  public static async findById(id: number, trx: Knex | Knex.Transaction = knex): Promise<ZonaComunRow | undefined> {
    return trx<ZonaComunRow>(TABLE).where("id", id).first();
  }

  public static async findByIdForShare(trx: Knex.Transaction, id: number): Promise<ZonaComunRow | undefined> {
    return trx<ZonaComunRow>(TABLE).where("id", id).forShare().first();
  }

  public static async findByIdForUpdate(trx: Knex.Transaction, id: number): Promise<ZonaComunRow | undefined> {
    return trx<ZonaComunRow>(TABLE).where("id", id).forUpdate().first();
  }

  public static async existsNombre(nombre: string, exceptoId?: number): Promise<boolean> {
    const query = knex(TABLE).whereRaw("lower(nombre) = lower(?)", [nombre]);
    const fila = await (exceptoId ? query.andWhereNot("id", exceptoId) : query).first("id");
    return Boolean(fila);
  }

  public static async insert(input: ZonaComunInput): Promise<ZonaComunRow> {
    const [row] = await knex<ZonaComunRow>(TABLE).insert(columnas(input)).returning("*");
    return row as ZonaComunRow;
  }

  public static async update(trx: Knex.Transaction, id: number, input: ZonaComunInput): Promise<ZonaComunRow> {
    const [row] = await trx<ZonaComunRow>(TABLE)
      .where("id", id)
      .update({ ...columnas(input), updated_at: trx.fn.now() })
      .returning("*");
    return row as ZonaComunRow;
  }

  public static async setActiva(trx: Knex.Transaction, id: number, activa: boolean): Promise<ZonaComunRow> {
    const [row] = await trx<ZonaComunRow>(TABLE).where("id", id).update({ activa, updated_at: trx.fn.now() }).returning("*");
    return row as ZonaComunRow;
  }
}

export default ZonaRepository;
