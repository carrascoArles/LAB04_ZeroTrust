import type { ApiClient } from "./http";
import {
  projectListSchema,
  projectSchema,
  projectStatsSchema,
  type CreateProjectRequest,
  type Project,
  type ProjectStats,
} from "./schemas";

const projectPath = (projectId: string) => `/v1/projects/${encodeURIComponent(projectId)}`;

/** listProjects: GET /v1/projects (público, HU-01). */
export async function listProjects(api: ApiClient, signal?: AbortSignal): Promise<Project[]> {
  const { items } = await api.request({
    operation: "listProjects",
    method: "GET",
    path: "/v1/projects",
    schema: projectListSchema,
    signal,
  });
  return items;
}

/** getProject: GET /v1/projects/{projectId} (público, HU-02). */
export function getProject(api: ApiClient, projectId: string, signal?: AbortSignal) {
  return api.request<Project>({
    operation: "getProject",
    method: "GET",
    path: projectPath(projectId),
    schema: projectSchema,
    signal,
  });
}

/** getProjectStats: GET /v1/projects/{projectId}/stats (público, HU-09). */
export function getProjectStats(api: ApiClient, projectId: string, signal?: AbortSignal) {
  return api.request<ProjectStats>({
    operation: "getProjectStats",
    method: "GET",
    path: `${projectPath(projectId)}/stats`,
    schema: projectStatsSchema,
    signal,
  });
}

/** createProject: POST /v1/projects (GESTOR, HU-08). */
export function createProject(api: ApiClient, accessToken: string, input: CreateProjectRequest) {
  return api.request<Project>({
    operation: "createProject",
    method: "POST",
    path: "/v1/projects",
    schema: projectSchema,
    accessToken,
    body: input,
  });
}

/** publishProject: PATCH /v1/projects/{projectId}/publish (GESTOR, HU-08). */
export function publishProject(api: ApiClient, accessToken: string, projectId: string) {
  return api.request<Project>({
    operation: "publishProject",
    method: "PATCH",
    path: `${projectPath(projectId)}/publish`,
    schema: projectSchema,
    accessToken,
  });
}
