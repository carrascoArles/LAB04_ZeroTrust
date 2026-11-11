import type { ZodType } from "zod";
import { ApiError, ContractError, NetworkError } from "./errors";
import { errorBodySchema } from "./schemas";

export type HttpMethod = "GET" | "POST" | "PATCH";

export interface ApiRequest<T> {
  /** operationId de docs/api.yaml; identifica la operación en los errores. */
  operation: string;
  method: HttpMethod;
  path: string;
  schema: ZodType<T>;
  /** Access token de Cognito. Nunca el ID token: el PEP lo rechaza (CA-03.2). */
  accessToken?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

export interface ApiClient {
  request<T>(request: ApiRequest<T>): Promise<T>;
}

const DEFAULT_MESSAGES: Record<number, { code: string; message: string }> = {
  400: { code: "VALIDATION_ERROR", message: "Los datos enviados no son válidos." },
  401: { code: "UNAUTHORIZED", message: "Se requiere autenticación." },
  403: { code: "FORBIDDEN", message: "No tiene permiso para realizar esta acción." },
  404: { code: "NOT_FOUND", message: "El recurso no existe." },
  409: { code: "CONFLICT", message: "La solicitud entró en conflicto con el estado actual." },
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * El backend responde con `Error` (code, message, requestId). El JWT authorizer responde
 * `{"message": "Unauthorized"}`, sin esos campos: en ese caso se usa un mensaje por código.
 */
function toApiError(status: number, body: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(status, parsed.data.code, parsed.data.message, parsed.data.requestId);
  }
  const fallback = DEFAULT_MESSAGES[status] ?? {
    code: "INTERNAL_ERROR",
    message: "Ocurrió un error interno.",
  };
  return new ApiError(status, fallback.code, fallback.message);
}

export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiClient {
  return {
    async request<T>({
      operation,
      method,
      path,
      schema,
      accessToken,
      body,
      headers,
      query,
      signal,
    }: ApiRequest<T>): Promise<T> {
      const url = new URL(`${baseUrl}${path}`);
      for (const [name, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== "") url.searchParams.set(name, value);
      }

      const requestHeaders = new Headers({ Accept: "application/json", ...headers });
      if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
      if (accessToken) requestHeaders.set("Authorization", `Bearer ${accessToken}`);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
          credentials: "omit",
          cache: "no-store",
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new NetworkError();
      }

      const payload = await readJson(response);
      if (!response.ok) throw toApiError(response.status, payload);

      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new ContractError(operation);
      return parsed.data;
    },
  };
}
