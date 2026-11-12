import { describe, expect, it } from "vitest";
import { handler as createProject } from "../src/projects/create.js";
import { handler as getProject } from "../src/projects/get.js";
import { handler as listProjects } from "../src/projects/list.js";
import { handler as publishProject } from "../src/projects/publish.js";
import { handler as getStats } from "../src/projects/stats.js";
import { handler as listAudit } from "../src/audit/list.js";
import {
  apiEvent,
  auditor,
  bodyOf,
  donante,
  gestor,
  newDraftProject,
  newPublishedProject,
} from "./helpers/events.js";
import { useDatabase } from "./helpers/harness.js";

useDatabase();

const valid = {
  title: "Comedor popular",
  description: "Raciones diarias",
  goalAmountCents: 100_000,
};
const unknownId = "00000000-0000-4000-8000-000000000000";

describe("catálogo público (HU-01)", () => {
  it("T01: un visitante recibe 200 y ningún borrador", async () => {
    const published = await newPublishedProject();
    await newDraftProject();
    const response = await listProjects(apiEvent());
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response).items.map((p: { projectId: string }) => p.projectId)).toEqual([
      published,
    ]);
  });

  it("CA-01.1: incluye nombre, finalidad, meta y suma confirmada", async () => {
    await newPublishedProject(700_000);
    const [item] = bodyOf(await listProjects(apiEvent())).items;
    expect(item).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      goalAmountCents: 700_000,
      confirmedAmountCents: 0,
      currency: "PEN",
      status: "PUBLICADO",
    });
  });

  it("CA-01.3: sin proyectos publicados responde 200 con lista vacía", async () => {
    const response = await listProjects(apiEvent());
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).toEqual({ items: [] });
  });
});

describe("detalle (HU-02)", () => {
  it("CA-02.1: muestra el proyecto publicado", async () => {
    const projectId = await newPublishedProject();
    const response = await getProject(apiEvent({ pathParameters: { projectId } }));
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response).projectId).toBe(projectId);
  });

  it("CA-02.2: un borrador responde 404 sin revelar contenido", async () => {
    const projectId = await newDraftProject();
    const response = await getProject(apiEvent({ pathParameters: { projectId } }));
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("Biblioteca");
  });

  it.each([unknownId, "no-es-uuid"])("CA-02.2: el id %s responde 404", async (projectId) => {
    const response = await getProject(apiEvent({ pathParameters: { projectId } }));
    expect(response.statusCode).toBe(404);
  });
});

describe("indicadores (HU-09)", () => {
  it("devuelve solo cifras agregadas", async () => {
    const projectId = await newPublishedProject(900_000);
    const response = await getStats(apiEvent({ pathParameters: { projectId } }));
    expect(bodyOf(response)).toEqual({
      projectId,
      goalAmountCents: 900_000,
      confirmedAmountCents: 0,
      currency: "PEN",
    });
  });

  it("un borrador responde 404", async () => {
    const projectId = await newDraftProject();
    expect((await getStats(apiEvent({ pathParameters: { projectId } }))).statusCode).toBe(404);
  });
});

describe("gestión de proyectos (HU-08)", () => {
  it("CA-08.1: GESTOR crea un proyecto en BORRADOR", async () => {
    const response = await createProject(apiEvent({ claims: gestor, body: valid }));
    expect(response.statusCode).toBe(201);
    expect(bodyOf(response)).toMatchObject({
      ...valid,
      status: "BORRADOR",
      confirmedAmountCents: 0,
    });
  });

  it("T03: un donante no puede crear un proyecto y no se escribe nada", async () => {
    const response = await createProject(apiEvent({ claims: donante, body: valid }));
    expect(response.statusCode).toBe(403);
    expect(bodyOf(await listProjects(apiEvent())).items).toEqual([]);
  });

  it("T03: un donante no puede publicar un proyecto", async () => {
    const projectId = await newDraftProject();
    const response = await publishProject(
      apiEvent({ claims: donante, pathParameters: { projectId } }),
    );
    expect(response.statusCode).toBe(403);
    expect((await getProject(apiEvent({ pathParameters: { projectId } }))).statusCode).toBe(404);
  });

  it("sin token responde 401", async () => {
    expect((await createProject(apiEvent({ body: valid }))).statusCode).toBe(401);
  });

  it.each([
    ["meta cero", { ...valid, goalAmountCents: 0 }],
    ["meta negativa", { ...valid, goalAmountCents: -1 }],
    ["meta decimal", { ...valid, goalAmountCents: 10.5 }],
    ["meta como texto", { ...valid, goalAmountCents: "100" }],
    ["título vacío", { ...valid, title: "" }],
    ["sin descripción", { title: "x", goalAmountCents: 100 }],
    ["estado impuesto", { ...valid, status: "PUBLICADO" }],
    ["acumulado impuesto", { ...valid, confirmedAmountCents: 999 }],
  ])("CA-08.1: %s responde 400", async (_name, body) => {
    expect((await createProject(apiEvent({ claims: gestor, body }))).statusCode).toBe(400);
  });

  it("un cuerpo que no es JSON responde 400", async () => {
    const event = apiEvent({ claims: gestor, rawBody: "{no json" });
    expect((await createProject(event)).statusCode).toBe(400);
  });

  it("CA-08.2: GESTOR publica un borrador", async () => {
    const projectId = await newDraftProject();
    const response = await publishProject(
      apiEvent({ claims: gestor, pathParameters: { projectId } }),
    );
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response).status).toBe("PUBLICADO");
  });

  it("CA-08.2: publicar uno ya publicado responde 409", async () => {
    const projectId = await newPublishedProject();
    const response = await publishProject(
      apiEvent({ claims: gestor, pathParameters: { projectId } }),
    );
    expect(response.statusCode).toBe(409);
  });

  it("publicar un id inexistente responde 404", async () => {
    const event = apiEvent({ claims: gestor, pathParameters: { projectId: unknownId } });
    expect((await publishProject(event)).statusCode).toBe(404);
  });

  it("publicaciones concurrentes: solo una tiene éxito", async () => {
    const projectId = await newDraftProject();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        publishProject(apiEvent({ claims: gestor, pathParameters: { projectId } })),
      ),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(4);
  });

  it("CA-08.3: crear y publicar dejan eventos de auditoría con actor seudonimizado", async () => {
    const projectId = await newPublishedProject();
    for (const eventType of ["PROJECT_CREATED", "PROJECT_PUBLISHED"]) {
      const { items } = bodyOf(
        await listAudit(apiEvent({ claims: auditor, query: { eventType } })),
      );
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        resourceRef: `project:${projectId}`,
        outcome: "SUCCESS",
        actorRef: expect.stringMatching(/^usr_[0-9a-f]{16}$/),
      });
      expect(JSON.stringify(items[0])).not.toContain("sub-gestor");
    }
  });
});
