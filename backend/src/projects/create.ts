import { randomUUID } from "node:crypto";
import { auditPut } from "../audit/record.js";
import { authorize } from "../authz/index.js";
import { table, transactWrite } from "../shared/db.js";
import { parseBody, route } from "../shared/http.js";
import { createProjectSchema } from "../shared/schemas.js";
import { projectView } from "./view.js";

/** POST /v1/projects: solo GESTOR; el proyecto siempre nace en BORRADOR (HU-08). */
export const handler = route("CreateProject", async (event, { requestId }) => {
  const { sub } = authorize(event, { group: "GESTOR", scope: "api/projects.write" });
  const input = parseBody(event, createProjectSchema);

  const now = new Date().toISOString();
  const project = {
    projectId: randomUUID(),
    title: input.title,
    description: input.description,
    goalAmountCents: input.goalAmountCents,
    confirmedAmountCents: 0,
    currency: "PEN",
    status: "BORRADOR",
    createdAt: now,
    updatedAt: now,
  };

  await transactWrite([
    {
      Put: {
        TableName: table("PROJECTS_TABLE"),
        Item: project,
        ConditionExpression: "attribute_not_exists(projectId)",
      },
    },
    auditPut({
      eventType: "PROJECT_CREATED",
      action: "CreateProject",
      actorSub: sub,
      resourceRef: `project:${project.projectId}`,
      requestId,
      timestamp: now,
    }),
  ]);

  return { status: 201, body: projectView(project) };
});
