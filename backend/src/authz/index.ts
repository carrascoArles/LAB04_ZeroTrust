import { createHash } from "node:crypto";
import { forbidden, unauthorized } from "../shared/errors.js";
import type { ApiEvent } from "../shared/http.js";

export type Group = "DONANTE" | "GESTOR" | "AUDITOR";

export interface Identity {
  sub: string;
  groups: string[];
}

export interface RoutePolicy {
  group: Group;
  scope: string;
}

/**
 * API Gateway entrega `cognito:groups` como texto, por ejemplo "[DONANTE GESTOR]". Se aceptan
 * también las otras formas posibles; cualquier valor no reconocido equivale a no tener grupos.
 */
export function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.filter((g): g is string => typeof g === "string");
  if (typeof claim !== "string") return [];
  return claim
    .replace(/[[\]"']/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
}

/**
 * Policy Engine (NIST SP 800-207). La identidad proviene solo de los claims que validó el JWT
 * authorizer; el cuerpo y las cabeceras nunca se consultan. Repite las comprobaciones del PEP
 * (tipo de token y scope) para que una ruta mal configurada falle cerrada.
 */
export function authorize(event: ApiEvent, policy: RoutePolicy): Identity {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) throw unauthorized();
  if (claims.token_use !== "access") throw unauthorized();
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw unauthorized();

  const scopes = typeof claims.scope === "string" ? claims.scope.split(" ") : [];
  if (!scopes.includes(policy.scope)) throw forbidden();

  const groups = parseGroups(claims["cognito:groups"]);
  if (!groups.includes(policy.group)) throw forbidden();

  return { sub: claims.sub, groups };
}

/** Referencia estable para auditoría que no expone el sub (CA-10.2). */
export function pseudonym(sub: string): string {
  return `usr_${createHash("sha256").update(sub).digest("hex").slice(0, 16)}`;
}
