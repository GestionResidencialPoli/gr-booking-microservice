import HttpStatus from "../types/enums/http-status";
import CommunicationsClient, { CommunicationsError } from "./communications-client";
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
    const user = await this.consultar(userId);
    return {
      userId: user.id,
      nombre: `${user.firstName} ${user.lastName}`.trim(),
      apartamento: user.apartment ?? null,
    };
  }

  private static async consultar(userId: number): Promise<InternalUserResponse> {
    try {
      return await CommunicationsClient.request<InternalUserResponse>("user-microservice", "users.get", { id: userId });
    } catch (error) {
      if (!(error instanceof CommunicationsError)) throw error;
      if (error.code === "NO_ENCONTRADO") {
        throw new DomainError(HttpStatus.UnprocessableEntity, "RESIDENTE_DESCONOCIDO", "El usuario de la sesion no existe.");
      }

      Logger.warn("gr-user-microservice no respondio por el hub", { code: error.code, error: error.message, userId });
      throw directorioNoDisponible();
    }
  }
}

export default UserServiceClient;
