import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { authorize } from "../authz/index.js";
import { db, table } from "../shared/db.js";
import { route } from "../shared/http.js";
import { donationView } from "./view.js";

/** GET /v1/donations/me: la consulta se limita al sub del token; no acepta otro usuario (HU-07). */
export const handler = route("GetMyDonations", async (event) => {
  const { sub } = authorize(event, { group: "DONANTE", scope: "api/donations.read" });

  const items: ReturnType<typeof donationView>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db().send(
      new QueryCommand({
        TableName: table("DONATIONS_TABLE"),
        IndexName: "donorSub-createdAt",
        KeyConditionExpression: "donorSub = :sub",
        ExpressionAttributeValues: { ":sub": sub },
        ScanIndexForward: false,
        ExclusiveStartKey: cursor,
      }),
    );
    items.push(...(page.Items ?? []).map(donationView));
    cursor = page.LastEvaluatedKey;
  } while (cursor);

  return { status: 200, body: { items } };
});
