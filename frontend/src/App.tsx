import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth/AuthProvider";
import type { AuthService } from "./auth/AuthService";
import { ApiContext } from "./hooks/useApi";
import type { ApiClient } from "./services/http";

interface AppProvidersProps {
  api: ApiClient;
  auth: AuthService;
  queryClient: QueryClient;
  children: ReactNode;
}

/** Dependencias de la aplicación, inyectadas desde main.tsx o desde las pruebas. */
export function AppProviders({ api, auth, queryClient, children }: Readonly<AppProvidersProps>) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext value={api}>
        <AuthProvider service={auth}>{children}</AuthProvider>
      </ApiContext>
    </QueryClientProvider>
  );
}
