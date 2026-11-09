/** Error esperado de la API. Su mensaje se envía al cliente: nunca debe llevar datos internos. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message = "Los datos enviados no son válidos.") =>
  new ApiError(400, "VALIDATION_ERROR", message);

export const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Se requiere autenticación.");

export const forbidden = () =>
  new ApiError(403, "FORBIDDEN", "No tiene permiso para realizar esta acción.");

export const notFound = () => new ApiError(404, "NOT_FOUND", "El recurso no existe.");

export const conflict = (code: string, message: string) => new ApiError(409, code, message);
