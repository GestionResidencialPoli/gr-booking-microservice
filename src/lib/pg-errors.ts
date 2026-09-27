export const PG_UNIQUE_VIOLATION = "23505";
export const PG_CHECK_VIOLATION = "23514";
export const PG_EXCLUSION_VIOLATION = "23P01";

interface PgError {
  code?: string;
  constraint?: string;
}

class PgErrors {
  public static es(error: unknown, code: string, constraint?: string): boolean {
    const pgError = error as PgError;
    return pgError?.code === code && (!constraint || pgError.constraint === constraint);
  }
}

export default PgErrors;
