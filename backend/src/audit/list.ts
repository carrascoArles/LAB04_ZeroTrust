import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { authorize } from "../authz/index.js";
import { db, table } from "../shared/db.js";
import { badRequest } from "../shared/errors.js";
import { route } from "../shared/http.js";
import { auditQuerySchema } from "../shared/schemas.js";

const MAX_EVENTS = 200;

/** GET /v1/audit: solo AUDITOR, con filtros por tipo y fecha (HU-10). */
export const handler = route("ListAuditEvents", async (event) => {
  authorize(event, { group: "AUDITOR", scope: "api/audit.read" });

  const parsed = auditQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) throw badRequest();
  const { eventType, from, to } = parsed.data;

  const low = from ? new Date(from).toISOString() : "0000";
  const high = `${to ? new Date(to).toISOString() : "9999"}#￿`;

  const { Items = [] } = await db().send(
    new QueryCommand({
      TableName: table("AUDIT_TABLE"),
      KeyConditionExpression: "eventType = :type AND sk BETWEEN :low AND :high",
      ExpressionAttributeValues: { ":type": eventType, ":low": low, ":high": high },
      ScanIndexForward: false,
      Limit: MAX_EVENTS,
    }),
  );

  // Lista explícita: un atributo nuevo no se expone por accidente.
  const items = Items.map((item) => ({
    eventId: item.eventId,
    timestamp: item.timestamp,
    requestId: item.requestId,
    actorRef: item.actorRef,
    action: item.action,
    resourceRef: item.resourceRef,
    outcome: item.outcome,
  }));
  return { status: 200, body: { items } };
});
