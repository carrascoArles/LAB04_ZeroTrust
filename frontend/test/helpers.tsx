import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import type { Role } from "../src/auth/roles";
import { ApiContext } from "../src/hooks/useApi";
import { routes } from "../src/routes";
import { createApiClient } from "../src/services/http";
import type { Donation, Project } from "../src/services/schemas";

export const API_URL = "https://api.example.test/academic";

export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>;

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** API falso: responde según "MÉTODO /ruta" y registra cada solicitud recibida. */
export function fakeApi(handlers: Record<string, Handler>) {
  const requests: RecordedRequest[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const request: RecordedRequest = {
      method: init?.method ?? "GET",
      path: url.pathname.replace(new URL(API_URL).pathname, ""),
      query: url.searchParams,
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    const handler = handlers[`${request.method} ${request.path}`];
    if (!handler) {
      return json(404, { code: "NOT_FOUND", message: "El recurso no existe.", requestId: "r-404" });
    }
    return handler(request);
  };
  return { fetch: fetchImpl as typeof fetch, requests };
}

export function anonymous(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    accessToken: null,
    sessionExpired: false,
    hasRole: () => false,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    completeSignIn: vi.fn(async () => "/"),
    ...overrides,
  };
}

export function signedInAs(role: Role, overrides: Partial<AuthContextValue> = {}) {
  return anonymous({
    user: { sub: `sub-${role}`, email: `${role.toLowerCase()}@aqp-solidaria.test`, roles: [role] },
    accessToken: `access-token-${role}`,
    hasRole: (wanted) => wanted === role,
    ...overrides,
  });
}

export function renderApp({
  path = "/",
  auth = anonymous(),
  api = fakeApi({}),
}: {
  path?: string;
  auth?: AuthContextValue;
  api?: ReturnType<typeof fakeApi>;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <ApiContext value={createApiClient(API_URL, api.fetch)}>
        <AuthContext value={auth}>
          <RouterProvider router={router} />
        </AuthContext>
      </ApiContext>
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup(), requests: api.requests };
}

export const PROJECT_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
export const DONATION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

export function aProject(overrides: Partial<Project> = {}): Project {
  return {
    projectId: PROJECT_ID,
    title: "Agua segura para Characato",
    description: "Filtros de agua para 40 familias.",
    goalAmountCents: 500_000,
    confirmedAmountCents: 125_000,
    currency: "PEN",
    status: "PUBLICADO",
    ...overrides,
  };
}

export function aDonation(overrides: Partial<Donation> = {}): Donation {
  return {
    donationId: DONATION_ID,
    projectId: PROJECT_ID,
    amountCents: 1999,
    currency: "PEN",
    status: "PENDIENTE_SIMULACION",
    createdAt: "2026-11-11T15:30:00.000Z",
    ...overrides,
  };
}
