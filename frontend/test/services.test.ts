import { describe, expect, it } from "vitest";
import { listAuditEvents } from "../src/services/audit";
import {
  createDonation,
  getDonation,
  getMyDonations,
  simulateDonation,
} from "../src/services/donations";
import { ApiError, ContractError, NetworkError, toUserMessage } from "../src/services/errors";
import { createApiClient } from "../src/services/http";
import {
  createProject,
  getProject,
  getProjectStats,
  listProjects,
  publishProject,
} from "../src/services/projects";
import { API_URL, DONATION_ID, PROJECT_ID, aDonation, aProject, fakeApi, json } from "./helpers";

const TOKEN = "access-token";
const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";

describe("cliente del contrato docs/api.yaml", () => {
  it("las rutas públicas no envían Authorization", async () => {
    const api = fakeApi({
      "GET /v1/projects": () => json(200, { items: [aProject()] }),
      [`GET /v1/projects/${PROJECT_ID}`]: () => json(200, aProject()),
      [`GET /v1/projects/${PROJECT_ID}/stats`]: () =>
        json(200, {
          projectId: PROJECT_ID,
          goalAmountCents: 500_000,
          confirmedAmountCents: 1,
          currency: "PEN",
        }),
    });
    const client = createApiClient(API_URL, api.fetch);

    expect(await listProjects(client)).toHaveLength(1);
    expect((await getProject(client, PROJECT_ID)).title).toBe(aProject().title);
    expect((await getProjectStats(client, PROJECT_ID)).confirmedAmountCents).toBe(1);
    for (const request of api.requests) {
      expect(request.method).toBe("GET");
      expect(request.headers.has("Authorization")).toBe(false);
    }
  });

  it("createDonation envía el access token, la Idempotency-Key y solo projectId y amountCents", async () => {
    const api = fakeApi({ "POST /v1/donations": () => json(201, aDonation()) });
    const client = createApiClient(API_URL, api.fetch);

    const input = { projectId: PROJECT_ID, amountCents: 1999, donorSub: "otro" } as never;
    await createDonation(client, TOKEN, input, KEY);

    const [request] = api.requests;
    expect(request?.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(request?.headers.get("Idempotency-Key")).toBe(KEY);
    expect(request?.headers.get("Content-Type")).toBe("application/json");
    // El donante sale del token (CA-05.3): un campo extra nunca llega al cuerpo.
    expect(request?.body).toEqual({ projectId: PROJECT_ID, amountCents: 1999 });
  });

  it("usa el método y la ruta de cada operación protegida", async () => {
    const created = aProject({ status: "BORRADOR" });
    const api = fakeApi({
      "POST /v1/projects": () => json(201, created),
      [`PATCH /v1/projects/${PROJECT_ID}/publish`]: () => json(200, aProject()),
      "GET /v1/donations/me": () => json(200, { items: [aDonation()] }),
      [`GET /v1/donations/${DONATION_ID}`]: () => json(200, aDonation()),
      [`POST /v1/donations/${DONATION_ID}/simulate`]: () =>
        json(200, aDonation({ status: "CONFIRMADA_SIMULADA" })),
      "GET /v1/audit": () => json(200, { items: [] }),
    });
    const client = createApiClient(API_URL, api.fetch);

    await createProject(client, TOKEN, { title: "T", description: "D", goalAmountCents: 1 });
    await publishProject(client, TOKEN, PROJECT_ID);
    await getMyDonations(client, TOKEN);
    await getDonation(client, TOKEN, DONATION_ID);
    await simulateDonation(client, TOKEN, DONATION_ID, "CONFIRMADA_SIMULADA");
    await listAuditEvents(client, TOKEN, {
      eventType: "DONATION_CREATED",
      from: "2026-11-01T05:00:00.000Z",
    });

    expect(api.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /v1/projects",
      `PATCH /v1/projects/${PROJECT_ID}/publish`,
      "GET /v1/donations/me",
      `GET /v1/donations/${DONATION_ID}`,
      `POST /v1/donations/${DONATION_ID}/simulate`,
      "GET /v1/audit",
    ]);
    expect(api.requests.every((r) => r.headers.get("Authorization") === `Bearer ${TOKEN}`)).toBe(
      true,
    );
    expect(api.requests[4]?.body).toEqual({ outcome: "CONFIRMADA_SIMULADA" });
    const audit = api.requests[5]?.query;
    expect(audit?.get("eventType")).toBe("DONATION_CREATED");
    expect(audit?.get("from")).toBe("2026-11-01T05:00:00.000Z");
    expect(audit?.has("to")).toBe(false);
  });
});

describe("errores", () => {
  it("convierte el Error uniforme del backend y conserva el requestId", async () => {
    const api = fakeApi({
      "POST /v1/donations": () =>
        json(409, {
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "La clave ya se usó con otros datos.",
          requestId: "req-123",
        }),
    });
    const client = createApiClient(API_URL, api.fetch);

    const error = await createDonation(
      client,
      TOKEN,
      { projectId: PROJECT_ID, amountCents: 100 },
      KEY,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
      requestId: "req-123",
    });
    expect(toUserMessage(error)).toEqual({
      title: "La clave ya se usó con otros datos.",
      requestId: "req-123",
    });
  });

  it("interpreta el 401 del JWT authorizer, que no sigue el esquema Error", async () => {
    const api = fakeApi({ "GET /v1/donations/me": () => json(401, { message: "Unauthorized" }) });
    const error = await getMyDonations(createApiClient(API_URL, api.fetch), "vencido").catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(toUserMessage(error).needsSignIn).toBe(true);
  });

  it("rechaza una respuesta que no cumple el contrato", async () => {
    const api = fakeApi({
      "GET /v1/projects": () => json(200, { items: [{ ...aProject(), goalAmountCents: 19.99 }] }),
    });
    await expect(listProjects(createApiClient(API_URL, api.fetch))).rejects.toBeInstanceOf(
      ContractError,
    );
  });

  it("distingue una falla de red", async () => {
    const failing = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const error = await listProjects(createApiClient(API_URL, failing)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(toUserMessage(error).title).toBe("No se pudo conectar con el servidor.");
  });

  it("nunca incluye el token en el mensaje para la persona", async () => {
    const api = fakeApi({ "GET /v1/audit": () => json(403, { message: "Forbidden" }) });
    const error = await listAuditEvents(createApiClient(API_URL, api.fetch), "secreto", {
      eventType: "X",
    }).catch((e: unknown) => e);
    expect(JSON.stringify(toUserMessage(error))).not.toContain("secreto");
  });
});
