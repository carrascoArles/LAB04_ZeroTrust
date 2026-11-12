import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, table } from "../shared/db.js";
import { route } from "../shared/http.js";
import { projectView } from "./view.js";

/** GET /v1/projects: catálogo público; un BORRADOR no aparece (HU-01). */
export const handler = route("ListProjects", async () => {
  const items: ReturnType<typeof projectView>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db().send(
      new QueryCommand({
        TableName: table("PROJECTS_TABLE"),
        IndexName: "status-createdAt",
        KeyConditionExpression: "#status = :published",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":published": "PUBLICADO" },
        ScanIndexForward: false,
        ExclusiveStartKey: cursor,
      }),
    );
    items.push(...(page.Items ?? []).map(projectView));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return { status: 200, body: { items } };
});
