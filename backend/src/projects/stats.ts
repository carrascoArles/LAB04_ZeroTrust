import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db, table } from "../shared/db.js";
import { notFound } from "../shared/errors.js";
import { route } from "../shared/http.js";
import { resourceId } from "../shared/schemas.js";

/** GET /v1/projects/{projectId}/stats: solo cifras agregadas confirmadas (HU-09). */
export const handler = route("GetProjectStats", async (event) => {
  const projectId = resourceId(event.pathParameters?.projectId);
  const { Item } = await db().send(
    new GetCommand({ TableName: table("PROJECTS_TABLE"), Key: { projectId } }),
  );
  if (Item?.status !== "PUBLICADO") throw notFound();
  return {
    status: 200,
    body: {
      projectId,
      goalAmountCents: Item.goalAmountCents,
      confirmedAmountCents: Item.confirmedAmountCents,
      currency: Item.currency,
    },
  };
});
