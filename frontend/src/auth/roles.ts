export const ROLES = ["DONANTE", "GESTOR", "AUDITOR"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  DONANTE: "Donante",
  GESTOR: "Gestor",
  AUDITOR: "Auditor",
};

/**
 * Roles a partir del claim `cognito:groups`. Solo adapta la interfaz: quien decide es el
 * módulo authz del backend con el token verificado (constitución, principio II).
 */
export function rolesFromClaim(claim: unknown): Role[] {
  if (!Array.isArray(claim)) return [];
  return ROLES.filter((role) => claim.includes(role));
}
