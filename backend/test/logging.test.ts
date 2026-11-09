import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler as listProjects } from "../src/projects/list.js";
import { setDbClient, type DbClient } from "../src/shared/db.js";
import { apiEvent, bodyOf, donante, gestor } from "./helpers/events.js";
import { handler as createProject } from "../src/projects/create.js";
import { useDatabase } from "./helpers/harness.js";

useDatabase();

const SECRET_TOKEN = "eyJhbGciOiJSUzI1NiJ9.secreto.firma";
const SECRET_MAIL = "persona@example.com";
const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  for (const method of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => vi.restoreAllMocks());

const lastLog = () => JSON.parse(logged.at(-1) ?? "{}") as Record<string, unknown>;

describe("logs (CA-NF07.1, CA-NF01.2)", () => {
  it("una solicitud exitosa registra requestId, acción, resultado, código y duración", async () => {
    const event = apiEvent();
    await listProjects(event);
    expect(lastLog()).toMatchObject({
      requestId: event.requestContext.requestId,
      action: "ListProjects",
      outcome: "SUCCESS",
      status: 200,
      durationMs: expect.any(Number),
    });
  });

  it("CA-NF07.2: un rechazo queda registrado como tal", async () => {
    await createProject(apiEvent({ claims: donante, body: { title: "x" } }));
    expect(lastLog()).toMatchObject({ outcome: "REJECTED", status: 403 });
  });

  it("no registra token, cuerpo, correo ni sub", async () => {
    const claims = { ...gestor, email: SECRET_MAIL };
    await createProject(
      apiEvent({
        claims,
        headers: { authorization: `Bearer ${SECRET_TOKEN}` },
        body: { title: "Campaña privada", description: SECRET_MAIL, goalAmountCents: 100 },
      }),
    );
    const text = logged.join("\n");
    expect(text).not.toContain(SECRET_TOKEN);
    expect(text).not.toContain(SECRET_MAIL);
    expect(text).not.toContain("Campaña privada");
    expect(text).not.toContain("sub-gestor");
  });

  it("T10: un AccessDenied se convierte en error controlado sin detalles internos", async () => {
    const denied = Object.assign(
      new Error("User arn:aws:sts::123456789012:assumed-role/x is not authorized"),
      { name: "AccessDeniedException" },
    );
    setDbClient({ send: () => Promise.reject(denied) } as unknown as DbClient);
    const event = apiEvent();
    const response = await listProjects(event);
    expect(response.statusCode).toBe(500);
    expect(bodyOf(response)).toEqual({
      code: "INTERNAL_ERROR",
      message: expect.any(String),
      requestId: event.requestContext.requestId,
    });
    expect(response.body).not.toContain("arn:aws");
    expect(logged.join("\n")).not.toContain("123456789012");
    expect(lastLog()).toMatchObject({
      outcome: "ERROR",
      status: 500,
      errorName: "AccessDeniedException",
    });
  });

  it("las respuestas no se guardan en caché", async () => {
    const response = await listProjects(apiEvent());
    expect(response.headers?.["cache-control"]).toBe("no-store");
  });
});
