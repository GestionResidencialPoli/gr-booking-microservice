import config from "../config";
import HttpStatus from "../types/enums/http-status";
import DomainError from "./domain-error";
import Logger from "./logger";

export interface ApartamentoResidente {
  id: number;
  torre: string;
  numero: string;
  activo: boolean;
  tipoResidente: "PROPIETARIO" | "ARRENDATARIO";
}

export interface Residente {
  userId: number;
  nombre: string;
  apartamento: ApartamentoResidente | null;
}

interface InternalUserResponse {
  id: number;
  firstName: string;
  lastName: string;
  apartment: ApartamentoResidente | null;
}

function directorioNoDisponible(): DomainError {
  return new DomainError(
    HttpStatus.BadGateway,
    "DIRECTORIO_NO_DISPONIBLE",
    "No fue posible consultar el apartamento del residente. Intenta de nuevo en unos segundos.",
  );
}

class UserServiceClient {
  public static async residente(userId: number): Promise<Residente> {
    let response: Response;
    try {
      response = await fetch(`${config.userService.url}/api/v1/internal/users/${userId}`, {
        headers: { "X-Internal-Token": config.userService.internalToken },
        signal: AbortSignal.timeout(config.userService.timeoutMs),
      });
    } catch (error) {
      Logger.warn("gr-user-microservice no respondio", { error: (error as Error).message, userId });
      throw directorioNoDisponible();
    }

    if (response.status === HttpStatus.NotFound) {
      throw new DomainError(HttpStatus.UnprocessableEntity, "RESIDENTE_DESCONOCIDO", "El usuario de la sesion no existe.");
    }
    if (!response.ok) {
      Logger.warn("gr-user-microservice respondio con error", { status: response.status, userId });
      throw directorioNoDisponible();
    }

    const user = (await response.json()) as InternalUserResponse;
    return {
      userId: user.id,
      nombre: `${user.firstName} ${user.lastName}`.trim(),
      apartamento: user.apartment ?? null,
    };
  }
}

export default UserServiceClient;
