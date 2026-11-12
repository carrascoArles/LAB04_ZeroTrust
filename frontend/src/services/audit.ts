import type { ApiClient } from "./http";
import { auditEventListSchema, type AuditEvent } from "./schemas";

export interface AuditFilters {
  eventType: string;
  /** ISO 8601 con zona horaria. */
  from?: string;
  to?: string;
}

/** listAuditEvents: GET /v1/audit (AUDITOR, HU-10). */
export async function listAuditEvents(
  api: ApiClient,
  accessToken: string,
  filters: AuditFilters,
  signal?: AbortSignal,
): Promise<AuditEvent[]> {
  const { items } = await api.request({
    operation: "listAuditEvents",
    method: "GET",
    path: "/v1/audit",
    schema: auditEventListSchema,
    accessToken,
    query: { eventType: filters.eventType, from: filters.from, to: filters.to },
    signal,
  });
  return items;
}
