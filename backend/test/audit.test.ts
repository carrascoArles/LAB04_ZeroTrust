import { describe, expect, it } from "vitest";
import { handler as listAudit } from "../src/audit/list.js";
import {
  apiEvent,
  auditor,
  bodyOf,
  donante,
  donate,
  gestor,
  newPublishedProject,
} from "./helpers/events.js";
import { useDatabase } from "./helpers/harness.js";

useDatabase();

describe("consulta de auditoría (HU-10)", () => {
  it("CA-10.1: AUDITOR filtra por tipo", async () => {
    const projectId = await newPublishedProject();
    await donate(projectId, 1_000);
    const { items } = bodyOf(
      await listAudit(apiEvent({ claims: auditor, query: { eventType: "DONATION_CREATED" } })),
    );
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe("CreateDonation");
  });

  it("CA-10.1: filtra por fecha", async () => {
    await newPublishedProject();
    const query = (from: string, to: string) =>
      listAudit(apiEvent({ claims: auditor, query: { eventType: "PROJECT_CREATED", from, to } }));
    const past = await query("2000-01-01T00:00:00.000Z", "2000-12-31T00:00:00.000Z");
    expect(bodyOf(past).items).toEqual([]);
    const now = await query("2000-01-01T00:00:00.000Z", "2999-01-01T00:00:00.000Z");
    expect(bodyOf(now).items).toHaveLength(1);
  });

  it("CA-10.2: incluye los campos pedidos y ningún dato sensible", async () => {
    const projectId = await newPublishedProject();
    await donate(projectId, 1_000);
    const { items } = bodyOf(
      await listAudit(apiEvent({ claims: auditor, query: { eventType: "DONATION_CREATED" } })),
    );
    expect(Object.keys(items[0]).sort()).toEqual(
      ["action", "actorRef", "eventId", "outcome", "requestId", "resourceRef", "timestamp"].sort(),
    );
    const text = JSON.stringify(items);
    expect(text).not.toContain("sub-donante");
    expect(text).not.toContain("amountCents");
  });

  it.each([
    ["donante", donante],
    ["gestor", gestor],
  ])("CA-10.1: %s recibe 403", async (_name, claims) => {
    const event = apiEvent({ claims, query: { eventType: "PROJECT_CREATED" } });
    expect((await listAudit(event)).statusCode).toBe(403);
  });

  it("sin token responde 401", async () => {
    expect((await listAudit(apiEvent({ query: { eventType: "X" } }))).statusCode).toBe(401);
  });

  it("sin eventType o con fecha inválida responde 400", async () => {
    expect((await listAudit(apiEvent({ claims: auditor }))).statusCode).toBe(400);
    const event = apiEvent({ claims: auditor, query: { eventType: "X", from: "ayer" } });
    expect((await listAudit(event)).statusCode).toBe(400);
  });
});
