import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./services/errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Un 4xx no mejora al repetirlo; solo se reintentan fallas de red o del servidor.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
}
