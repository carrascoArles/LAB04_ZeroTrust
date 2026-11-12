/** Error HTTP del API. `requestId` existe cuando responde el backend, no el JWT authorizer. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** No hubo respuesta: sin red, CORS o CSP. */
export class NetworkError extends Error {
  constructor() {
    super("No se pudo conectar con el servidor.");
    this.name = "NetworkError";
  }
}

/** La respuesta no cumple docs/api.yaml. */
export class ContractError extends Error {
  constructor(readonly operation: string) {
    super(`La respuesta de ${operation} no cumple el contrato.`);
    this.name = "ContractError";
  }
}

export interface UserMessage {
  title: string;
  detail?: string;
  requestId?: string;
  /** El usuario debe volver a iniciar sesión. */
  needsSignIn?: boolean;
}

/**
 * Traduce cualquier error a un mensaje para la persona. Nunca incluye tokens ni el cuerpo
 * enviado; solo el `requestId`, que sirve para reportar el problema (TAREAS: «sin el token»).
 */
export function toUserMessage(error: unknown): UserMessage {
  if (error instanceof ApiError) {
    const requestId = error.requestId;
    switch (error.status) {
      case 401:
        return {
          title: "Tu sesión no es válida o ya expiró.",
          detail: "Vuelve a iniciar sesión para continuar.",
          requestId,
          needsSignIn: true,
        };
      case 403:
        return { title: "Tu cuenta no tiene permiso para esta acción.", requestId };
      case 404:
        return { title: "No encontramos lo que buscas.", detail: error.message, requestId };
      case 400:
      case 409:
        return { title: error.message, requestId };
      default:
        return {
          title: "El servidor tuvo un problema.",
          detail: "Inténtalo de nuevo en unos minutos.",
          requestId,
        };
    }
  }
  if (error instanceof NetworkError) {
    return {
      title: "No se pudo conectar con el servidor.",
      detail: "Revisa tu conexión a internet e inténtalo de nuevo.",
    };
  }
  if (error instanceof ContractError) {
    return {
      title: "El servidor respondió con datos inesperados.",
      detail: "Avísale al equipo: la respuesta no coincide con el contrato del API.",
    };
  }
  return {
    title: "Ocurrió un error inesperado.",
    detail: "Recarga la página e inténtalo de nuevo.",
  };
}
