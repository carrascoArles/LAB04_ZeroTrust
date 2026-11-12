import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handler as createDonation } from "../src/donations/create.js";
import { handler as getDonation } from "../src/donations/get.js";
import { handler as myDonations } from "../src/donations/me.js";
import { handler as simulate } from "../src/donations/simulate.js";
import { handler as getStats } from "../src/projects/stats.js";
import {
  apiEvent,
  auditor,
  bodyOf,
  donante,
  donate,
  gestor,
  newDraftProject,
  newPublishedProject,
  otroDonante,
  type Claims,
} from "./helpers/events.js";
import { useDatabase } from "./helpers/harness.js";

useDatabase();

const CONFIRM = "CONFIRMADA_SIMULADA";
const REJECT = "RECHAZADA_SIMULADA";
const unknownId = "00000000-0000-4000-8000-000000000000";

const history = async (claims: Claims = donante) =>
  bodyOf(await myDonations(apiEvent({ claims }))).items as Array<Record<string, unknown>>;

const confirmedTotal = async (projectId: string) =>
  bodyOf(await getStats(apiEvent({ pathParameters: { projectId } }))).confirmedAmountCents;

const simulateAs = (donationId: string, outcome: unknown = CONFIRM, claims: Claims = donante) =>
  simulate(apiEvent({ claims, pathParameters: { donationId }, body: { outcome } }));

async function pendingDonation(amountCents = 2_500) {
  const projectId = await newPublishedProject();
  const donationId = bodyOf(await donate(projectId, amountCents)).donationId as string;
  return { projectId, donationId };
}

describe("intención de donación (HU-05)", () => {
  it("T05: una intención válida responde 201, pendiente y en PEN", async () => {
    const projectId = await newPublishedProject();
    const response = await donate(projectId, 2_500);
    expect(response.statusCode).toBe(201);
    expect(bodyOf(response)).toMatchObject({
      projectId,
      amountCents: 2_500,
      currency: "PEN",
      status: "PENDIENTE_SIMULACION",
    });
  });

  it.each([100, 100_000])("CA-05.1: acepta el límite %i", async (amount) => {
    const projectId = await newPublishedProject();
    expect((await donate(projectId, amount)).statusCode).toBe(201);
  });

  it.each([
    ["cero", 0],
    ["negativo", -100],
    ["bajo el mínimo", 99],
    ["sobre el máximo", 100_001],
    ["no entero", 100.5],
    ["texto", "1000"],
    ["nulo", null],
  ])("T04: monto %s responde 400 y no cambia nada", async (_name, amount) => {
    const projectId = await newPublishedProject();
    expect((await donate(projectId, amount)).statusCode).toBe(400);
    expect(await history()).toEqual([]);
    expect(await confirmedTotal(projectId)).toBe(0);
  });

  it("CA-05.2: sin Idempotency-Key responde 400", async () => {
    const projectId = await newPublishedProject();
    const event = apiEvent({ claims: donante, body: { projectId, amountCents: 1_000 } });
    expect((await createDonation(event)).statusCode).toBe(400);
  });

  it("CA-05.2: una Idempotency-Key que no es UUID responde 400", async () => {
    const projectId = await newPublishedProject();
    expect((await donate(projectId, 1_000, { key: "abc" })).statusCode).toBe(400);
  });

  it("CA-05.2: un proyecto inexistente responde 404", async () => {
    expect((await donate(unknownId)).statusCode).toBe(404);
  });

  it("CA-05.2: un proyecto en BORRADOR responde 409", async () => {
    expect((await donate(await newDraftProject())).statusCode).toBe(409);
  });

  it("CA-05.3: un donorSub en el cuerpo se rechaza", async () => {
    const projectId = await newPublishedProject();
    const event = apiEvent({
      claims: donante,
      headers: { "idempotency-key": randomUUID() },
      body: { projectId, amountCents: 1_000, donorSub: "sub-victima" },
    });
    expect((await createDonation(event)).statusCode).toBe(400);
    expect(await history(accessTokenOfVictim())).toEqual([]);
  });

  it("CA-05.5: datos de tarjeta en el cuerpo se rechazan", async () => {
    const projectId = await newPublishedProject();
    const event = apiEvent({
      claims: donante,
      headers: { "idempotency-key": randomUUID() },
      body: { projectId, amountCents: 1_000, cardNumber: "4111111111111111" },
    });
    expect((await createDonation(event)).statusCode).toBe(400);
  });

  it("solo DONANTE puede donar", async () => {
    const projectId = await newPublishedProject();
    expect((await donate(projectId, 1_000, { claims: gestor })).statusCode).toBe(403);
    expect((await donate(projectId, 1_000, { claims: auditor })).statusCode).toBe(403);
  });

  it("sin token responde 401", async () => {
    const event = apiEvent({
      headers: { "idempotency-key": randomUUID() },
      body: { projectId: unknownId, amountCents: 1_000 },
    });
    expect((await createDonation(event)).statusCode).toBe(401);
  });
});

function accessTokenOfVictim(): Claims {
  return { ...donante, sub: "sub-victima" };
}

describe("idempotencia (CA-05.4, AD-05)", () => {
  it("T06: misma clave y carga devuelven el mismo resultado y una sola donación", async () => {
    const projectId = await newPublishedProject();
    const key = randomUUID();
    const first = await donate(projectId, 2_000, { key });
    const second = await donate(projectId, 2_000, { key });
    expect(second.statusCode).toBe(first.statusCode);
    expect(bodyOf(second).donationId).toBe(bodyOf(first).donationId);
    expect(await history()).toHaveLength(1);
  });

  it("T06: reintentos concurrentes crean una sola donación", async () => {
    const projectId = await newPublishedProject();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => donate(projectId, 2_000, { key })),
    );
    expect(await history()).toHaveLength(1);
    const created = results.filter((r) => r.statusCode === 201);
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(new Set(created.map((r) => bodyOf(r).donationId)).size).toBe(1);
    for (const result of results) expect([201, 409]).toContain(result.statusCode);
  });

  it("T07: misma clave con carga distinta responde 409 sin crear otra", async () => {
    const projectId = await newPublishedProject();
    const key = randomUUID();
    await donate(projectId, 2_000, { key });
    expect((await donate(projectId, 3_000, { key })).statusCode).toBe(409);
    expect(await history()).toHaveLength(1);
  });

  it("la clave es por usuario: otro donante puede usar la misma", async () => {
    const projectId = await newPublishedProject();
    const key = randomUUID();
    await donate(projectId, 2_000, { key });
    const response = await donate(projectId, 2_000, { key, claims: otroDonante });
    expect(response.statusCode).toBe(201);
    expect(await history(otroDonante)).toHaveLength(1);
  });

  it("un rechazo por proyecto en BORRADOR no consume la clave", async () => {
    const projectId = await newDraftProject();
    const key = randomUUID();
    expect((await donate(projectId, 2_000, { key })).statusCode).toBe(409);
    expect(await history()).toEqual([]);
  });
});

describe("simulación (HU-06)", () => {
  it("CA-06.1: confirma una donación propia y suma al acumulado", async () => {
    const { projectId, donationId } = await pendingDonation(2_500);
    const response = await simulateAs(donationId);
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response).status).toBe(CONFIRM);
    expect(await confirmedTotal(projectId)).toBe(2_500);
  });

  it("CA-06.3: una donación rechazada no cambia las cifras", async () => {
    const { projectId, donationId } = await pendingDonation();
    const response = await simulateAs(donationId, REJECT);
    expect(bodyOf(response).status).toBe(REJECT);
    expect(await confirmedTotal(projectId)).toBe(0);
  });

  it("T08: 10 confirmaciones concurrentes producen un solo incremento", async () => {
    const { projectId, donationId } = await pendingDonation(2_500);
    const results = await Promise.all(Array.from({ length: 10 }, () => simulateAs(donationId)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(9);
    expect(await confirmedTotal(projectId)).toBe(2_500);
  });

  it("confirmar y rechazar en paralelo: solo gana una transición", async () => {
    const { projectId, donationId } = await pendingDonation(2_500);
    const [a, b] = await Promise.all([simulateAs(donationId), simulateAs(donationId, REJECT)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const winner = a.statusCode === 200 ? a : b;
    const expected = bodyOf(winner).status === CONFIRM ? 2_500 : 0;
    expect(await confirmedTotal(projectId)).toBe(expected);
  });

  it("CA-06.2: una segunda transición responde 409 y no cambia el total", async () => {
    const { projectId, donationId } = await pendingDonation(2_500);
    await simulateAs(donationId);
    expect((await simulateAs(donationId)).statusCode).toBe(409);
    expect((await simulateAs(donationId, REJECT)).statusCode).toBe(409);
    expect(await confirmedTotal(projectId)).toBe(2_500);
  });

  it("varias donaciones suman correctamente", async () => {
    const projectId = await newPublishedProject();
    for (const amount of [100, 2_500, 100_000]) {
      const { donationId } = bodyOf(await donate(projectId, amount));
      await simulateAs(donationId);
    }
    expect(await confirmedTotal(projectId)).toBe(102_600);
  });

  it("ráfaga: muchas donaciones distintas a la vez no pierden ningún monto", async () => {
    const projectId = await newPublishedProject();
    const amounts = Array.from({ length: 20 }, (_, i) => 100 + i * 7);

    const created = await Promise.all(amounts.map((amount) => donate(projectId, amount)));
    expect(created.every((r) => r.statusCode === 201)).toBe(true);
    expect(await history()).toHaveLength(amounts.length);

    const results = await Promise.all(created.map((r) => simulateAs(bodyOf(r).donationId)));
    // Bajo conflicto puede quedar alguna pendiente (409 reintentable), pero el acumulado debe
    // ser exactamente la suma de las confirmadas: ni montos perdidos ni contados dos veces.
    for (const result of results) expect([200, 409]).toContain(result.statusCode);
    const confirmed = results.flatMap((r, i) => (r.statusCode === 200 ? [amounts[i]!] : []));
    expect(confirmed.length).toBeGreaterThan(0);
    expect(await confirmedTotal(projectId)).toBe(confirmed.reduce((sum, a) => sum + a, 0));
  });

  it("BOLA: simular una donación ajena responde 404 y no la cambia", async () => {
    const { projectId, donationId } = await pendingDonation();
    const response = await simulateAs(donationId, CONFIRM, otroDonante);
    expect(response.statusCode).toBe(404);
    expect(await confirmedTotal(projectId)).toBe(0);
    expect((await history())[0]?.status).toBe("PENDIENTE_SIMULACION");
  });

  it("una donación inexistente responde 404", async () => {
    expect((await simulateAs(unknownId)).statusCode).toBe(404);
  });

  it.each(["PENDIENTE_SIMULACION", "PAGADA", 1, null])(
    "un resultado no permitido (%j) responde 400",
    async (outcome) => {
      const { donationId } = await pendingDonation();
      expect((await simulateAs(donationId, outcome)).statusCode).toBe(400);
    },
  );

  it("GESTOR no puede simular", async () => {
    const { donationId } = await pendingDonation();
    expect((await simulateAs(donationId, CONFIRM, gestor)).statusCode).toBe(403);
  });
});

describe("historial propio (HU-07)", () => {
  it("CA-07.1: muestra solo lo del sub autenticado, con fecha, importe, proyecto y estado", async () => {
    const projectId = await newPublishedProject();
    await donate(projectId, 1_000);
    await donate(projectId, 2_000, { claims: otroDonante });
    const items = await history();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      projectId,
      amountCents: 1_000,
      status: "PENDIENTE_SIMULACION",
      createdAt: expect.any(String),
    });
  });

  it("T09: consultar una donación ajena responde 404 sin datos", async () => {
    const { donationId } = await pendingDonation();
    const response = await getDonation(
      apiEvent({ claims: otroDonante, pathParameters: { donationId } }),
    );
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(donationId);
    expect(response.body).not.toContain("amountCents");
  });

  it("T09: la respuesta ajena es igual a la de una inexistente", async () => {
    const { donationId } = await pendingDonation();
    const foreign = await getDonation(
      apiEvent({ claims: otroDonante, pathParameters: { donationId } }),
    );
    const missing = await getDonation(
      apiEvent({ claims: otroDonante, pathParameters: { donationId: unknownId } }),
    );
    const foreignBody = bodyOf(foreign);
    delete foreignBody.requestId;
    const missingBody = bodyOf(missing);
    delete missingBody.requestId;
    expect(foreign.statusCode).toBe(missing.statusCode);
    expect(foreignBody).toEqual(missingBody);
  });

  it("el propietario consulta su donación y no se expone donorSub", async () => {
    const { donationId } = await pendingDonation();
    const response = await getDonation(
      apiEvent({ claims: donante, pathParameters: { donationId } }),
    );
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).not.toHaveProperty("donorSub");
    expect((await history())[0]).not.toHaveProperty("donorSub");
  });

  it("T12: un gestor no puede consultar historiales ni donaciones de otros", async () => {
    const { donationId } = await pendingDonation();
    expect((await myDonations(apiEvent({ claims: gestor }))).statusCode).toBe(403);
    const response = await getDonation(
      apiEvent({ claims: gestor, pathParameters: { donationId } }),
    );
    expect(response.statusCode).toBe(403);
  });

  it("sin token responde 401", async () => {
    expect((await myDonations(apiEvent())).statusCode).toBe(401);
  });
});

describe("indicadores (CA-09)", () => {
  it("la suma excluye pendientes y rechazadas y no expone donantes", async () => {
    const projectId = await newPublishedProject();
    const confirmed = bodyOf(await donate(projectId, 1_000)).donationId;
    const rejected = bodyOf(await donate(projectId, 2_000)).donationId;
    await donate(projectId, 4_000);
    await simulateAs(confirmed);
    await simulateAs(rejected, REJECT);
    const response = await getStats(apiEvent({ pathParameters: { projectId } }));
    expect(bodyOf(response).confirmedAmountCents).toBe(1_000);
    expect(response.body).not.toContain("sub-donante");
  });
});
