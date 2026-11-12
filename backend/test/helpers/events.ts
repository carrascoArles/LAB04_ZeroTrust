import { randomUUID } from "node:crypto";
import type { ApiEvent, ApiResponse } from "../../src/shared/http.js";
import { handler as createProject } from "../../src/projects/create.js";
import { handler as publishProject } from "../../src/projects/publish.js";
import { handler as createDonation } from "../../src/donations/create.js";

const ALL_SCOPES =
  "openid email api/projects.write api/donations.write api/donations.read api/audit.read";

export type Claims = Record<string, unknown>;

export function accessToken(sub: string, group?: string, extra: Claims = {}): Claims {
  return {
    sub,
    token_use: "access",
    client_id: "spa-client",
    scope: ALL_SCOPES,
    ...(group ? { "cognito:groups": `[${group}]` } : {}),
    ...extra,
  };
}

export const donante = accessToken("sub-donante-a", "DONANTE");
export const otroDonante = accessToken("sub-donante-b", "DONANTE");
export const gestor = accessToken("sub-gestor", "GESTOR");
export const auditor = accessToken("sub-auditor", "AUDITOR");

export interface EventOptions {
  claims?: Claims;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string>;
  query?: Record<string, string>;
}

export function apiEvent(options: EventOptions = {}): ApiEvent {
  const { claims, body, rawBody, headers, pathParameters, query } = options;
  return {
    version: "2.0",
    routeKey: "TEST /route",
    rawPath: "/route",
    rawQueryString: "",
    headers: headers ?? {},
    pathParameters,
    queryStringParameters: query,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    isBase64Encoded: false,
    requestContext: {
      requestId: `req-${randomUUID()}`,
      ...(claims ? { authorizer: { jwt: { claims, scopes: null } } } : {}),
    },
  } as unknown as ApiEvent;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bodyOf<T = Record<string, any>>(response: ApiResponse): T {
  return JSON.parse(response.body ?? "null") as T;
}

export function statusOf(response: ApiResponse): number {
  return response.statusCode;
}

export async function newDraftProject(goalAmountCents = 500_000): Promise<string> {
  const response = await createProject(
    apiEvent({
      claims: gestor,
      body: { title: "Biblioteca en Cayma", description: "Libros y mobiliario", goalAmountCents },
    }),
  );
  return bodyOf(response).projectId;
}

export async function newPublishedProject(goalAmountCents = 500_000): Promise<string> {
  const projectId = await newDraftProject(goalAmountCents);
  await publishProject(apiEvent({ claims: gestor, pathParameters: { projectId } }));
  return projectId;
}

export function donate(
  projectId: string,
  amountCents: unknown = 2_500,
  options: { claims?: Claims; key?: string } = {},
): ReturnType<typeof createDonation> {
  return createDonation(
    apiEvent({
      claims: options.claims ?? donante,
      headers: { "idempotency-key": options.key ?? randomUUID() },
      body: { projectId, amountCents },
    }),
  );
}
