import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ZodType } from "zod";
import { ApiError, badRequest } from "./errors.js";
import { logRequest } from "./logger.js";

export type ApiEvent = Omit<APIGatewayProxyEventV2, "requestContext"> & {
  requestContext: APIGatewayProxyEventV2["requestContext"] & {
    authorizer?: { jwt?: { claims: Record<string, unknown>; scopes?: string[] | null } };
  };
};

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

export interface RouteContext {
  requestId: string;
}

const HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

function respond(statusCode: number, body: unknown): ApiResponse {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

/**
 * Envuelve un caso de uso: deja un log por solicitud y convierte cualquier excepción en una
 * respuesta uniforme. Lo inesperado responde 500 sin revelar el motivo (design.md §4).
 */
export function route(
  action: string,
  execute: (event: ApiEvent, context: RouteContext) => Promise<RouteResult>,
): (event: ApiEvent) => Promise<ApiResponse> {
  return async (event) => {
    const startedAt = Date.now();
    const requestId = event.requestContext.requestId;
    const log = (status: number, outcome: "SUCCESS" | "REJECTED" | "ERROR", errorName?: string) =>
      logRequest({
        requestId,
        action,
        route: event.routeKey,
        status,
        outcome,
        durationMs: Date.now() - startedAt,
        ...(errorName ? { errorName } : {}),
      });

    try {
      const { status, body } = await execute(event, { requestId });
      log(status, "SUCCESS");
      return respond(status, body);
    } catch (error) {
      if (error instanceof ApiError) {
        log(error.status, "REJECTED");
        return respond(error.status, { code: error.code, message: error.message, requestId });
      }
      log(500, "ERROR", error instanceof Error ? error.name : "UnknownError");
      return respond(500, {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error interno.",
        requestId,
      });
    }
  };
}

export function header(event: ApiEvent, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** Interpreta y valida el cuerpo; cualquier falla responde 400 sin repetir lo recibido. */
export function parseBody<T>(event: ApiEvent, schema: ZodType<T>): T {
  let raw: unknown;
  try {
    const text = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf8")
      : (event.body ?? "");
    raw = JSON.parse(text);
  } catch {
    throw badRequest();
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest();
  return parsed.data;
}
