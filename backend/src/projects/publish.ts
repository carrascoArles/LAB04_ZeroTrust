import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { auditPut } from "../audit/record.js";
import { authorize } from "../authz/index.js";
import { db, isTransactionCanceled, table, transactWrite } from "../shared/db.js";
import { conflict, notFound } from "../shared/errors.js";
import { route } from "../shared/http.js";
import { resourceId } from "../shared/schemas.js";
import { projectView } from "./view.js";

const alreadyPublished = () => conflict("ALREADY_PUBLISHED", "El proyecto ya está publicado.");

/** PATCH /v1/projects/{projectId}/publish: solo GESTOR; una sola transición válida (HU-08). */
export const handler = route("PublishProject", async (event, { requestId }) => {
  const { sub } = authorize(event, { group: "GESTOR", scope: "api/projects.write" });
  const projectId = resourceId(event.pathParameters?.projectId);
  const tableName = table("PROJECTS_TABLE");

  const { Item } = await db().send(
    new GetCommand({ TableName: tableName, Key: { projectId }, ConsistentRead: true }),
  );
  if (!Item) throw notFound();
  if (Item.status !== "BORRADOR") throw alreadyPublished();

  const now = new Date().toISOString();
  try {
    await transactWrite([
      {
        Update: {
          TableName: tableName,
          Key: { projectId },
          UpdateExpression: "SET #status = :published, updatedAt = :now",
          ConditionExpression: "#status = :draft",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":published": "PUBLICADO",
            ":draft": "BORRADOR",
            ":now": now,
          },
        },
      },
      auditPut({
        eventType: "PROJECT_PUBLISHED",
        action: "PublishProject",
        actorSub: sub,
        resourceRef: `project:${projectId}`,
        requestId,
        timestamp: now,
      }),
    ]);
  } catch (error) {
    if (isTransactionCanceled(error)) throw alreadyPublished();
    throw error;
  }

  return { status: 200, body: projectView({ ...Item, status: "PUBLICADO", updatedAt: now }) };
});
