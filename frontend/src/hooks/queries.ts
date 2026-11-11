import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { listAuditEvents, type AuditFilters } from "../services/audit";
import { createDonation, getMyDonations, simulateDonation } from "../services/donations";
import { ApiError } from "../services/errors";
import {
  createProject,
  getProject,
  getProjectStats,
  listProjects,
  publishProject,
} from "../services/projects";
import type {
  CreateDonationRequest,
  CreateProjectRequest,
  SimulationOutcome,
} from "../services/schemas";
import { useApi } from "./useApi";

export const queryKeys = {
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  projectStats: (projectId: string) => ["projects", projectId, "stats"] as const,
  donations: ["donations"] as const,
  myDonations: (sub: string) => ["donations", "me", sub] as const,
  audit: (sub: string, filters: AuditFilters) => ["audit", sub, filters] as const,
};

/** Sin sesión no se llama al API protegido: se responde como lo haría el PEP. */
function requireToken(accessToken: string | null): string {
  if (!accessToken) throw new ApiError(401, "UNAUTHORIZED", "Se requiere autenticación.");
  return accessToken;
}

// ---- Proyectos (públicos) ----

export function useProjects() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => listProjects(api, signal),
  });
}

export function useProject(projectId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => getProject(api, projectId, signal),
  });
}

export function useProjectStats(projectId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.projectStats(projectId),
    queryFn: ({ signal }) => getProjectStats(api, projectId, signal),
  });
}

// ---- Proyectos (GESTOR) ----

export function useCreateProject() {
  const api = useApi();
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (input: CreateProjectRequest) =>
      createProject(api, requireToken(accessToken), input),
  });
}

export function usePublishProject() {
  const api = useApi();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => publishProject(api, requireToken(accessToken), projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

// ---- Donaciones (DONANTE) ----

export function useMyDonations() {
  const api = useApi();
  const { user, accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.myDonations(user?.sub ?? "anonimo"),
    queryFn: ({ signal }) => getMyDonations(api, requireToken(accessToken), signal),
    enabled: accessToken !== null,
  });
}

export interface CreateDonationVariables {
  input: CreateDonationRequest;
  idempotencyKey: string;
}

export function useCreateDonation() {
  const api = useApi();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CreateDonationVariables) =>
      createDonation(api, requireToken(accessToken), input, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.donations }),
  });
}

export function useSimulateDonation() {
  const api = useApi();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ donationId, outcome }: { donationId: string; outcome: SimulationOutcome }) =>
      simulateDonation(api, requireToken(accessToken), donationId, outcome),
    // Una confirmación cambia el monto confirmado del proyecto y el historial.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
        queryClient.invalidateQueries({ queryKey: queryKeys.donations }),
      ]),
  });
}

// ---- Auditoría (AUDITOR) ----

export function useAuditEvents(filters: AuditFilters | null) {
  const api = useApi();
  const { user, accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.audit(user?.sub ?? "anonimo", filters ?? { eventType: "" }),
    queryFn: ({ signal }) =>
      listAuditEvents(api, requireToken(accessToken), filters ?? { eventType: "" }, signal),
    enabled: accessToken !== null && filters !== null,
  });
}
