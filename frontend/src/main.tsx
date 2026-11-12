// Debe ir primero: desactiva el uso de `new Function` en Zod antes de crear esquemas (CSP).
import "./config/zod";
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "./App";
import { AuthService } from "./auth/AuthService";
import { createUserManager } from "./auth/oidc";
import { ConfigError, getConfig } from "./config/env";
import { ConfigErrorPage } from "./pages/ConfigErrorPage";
import { createQueryClient } from "./queryClient";
import { routes } from "./routes";
import { createApiClient } from "./services/http";

const container = document.getElementById("root");
if (!container) throw new Error("Falta el elemento #root en index.html.");
const root = createRoot(container);

try {
  const config = getConfig();
  const auth = new AuthService(createUserManager(config, window.sessionStorage), config);
  const api = createApiClient(config.apiUrl);

  root.render(
    <StrictMode>
      <AppProviders api={api} auth={auth} queryClient={createQueryClient()}>
        <RouterProvider router={createBrowserRouter(routes)} />
      </AppProviders>
    </StrictMode>,
  );
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  root.render(<ConfigErrorPage error={error} />);
}
