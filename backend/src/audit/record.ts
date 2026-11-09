import { randomUUID } from "node:crypto";
import { pseudonym } from "../authz/index.js";
import { table, type TransactItems } from "../shared/db.js";

export interface AuditInput {
  eventType: string;
  action: string;
  actorSub: string;
  resourceRef: string;
  requestId: string;
  timestamp: string;
}

/**
 * Operación para incluir el evento en la misma transacción que el cambio: si la auditoría no
 * se puede escribir, el cambio tampoco se aplica (CA-08.3).
 */
export function auditPut(input: AuditInput): TransactItems[number] {
  const eventId = randomUUID();
  return {
    Put: {
      TableName: table("AUDIT_TABLE"),
      Item: {
        eventType: input.eventType,
        sk: `${input.timestamp}#${eventId}`,
        eventId,
        timestamp: input.timestamp,
        requestId: input.requestId,
        actorRef: pseudonym(input.actorSub),
        action: input.action,
        resourceRef: input.resourceRef,
        outcome: "SUCCESS",
      },
    },
  };
}
