import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { User, type UserManager } from "oidc-client-ts";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../src/auth/AuthProvider";
import { AuthService } from "../src/auth/AuthService";
import { loadConfig } from "../src/config/env";
import { ApiContext } from "../src/hooks/useApi";
import { routes } from "../src/routes";
import { createApiClient } from "../src/services/http";
import { AuthContext } from "../src/auth/AuthContext";
import { API_URL, anonymous, fakeApi, json } from "./helpers";

const config = loadConfig(
  {
    VITE_API_URL: API_URL,
    VITE_COGNITO_DOMAIN: "https://auth.example.test",
    VITE_USER_POOL_ID: "us-east-2_TestPool1",
    VITE_CLIENT_ID: "test-client-id",
  },
  "http://localhost:3000",
);

/**
 * UserManager mínimo. En el navegador, React aplica la actualización de `userLoaded` después de
 * que la SPA ya navegó (el cambio de ruta es una transición); el stub lo reproduce avisando en la
 * siguiente vuelta del event loop.
 */
function stubUserManager() {
  const onLoaded: Array<(user: User) => void> = [];
  const now = Math.floor(Date.now() / 1000);
  const user = new User({
    access_token: "access",
    token_type: "Bearer",
    expires_at: now + 900,
    userState: { returnTo: "/" },
    profile: {
      sub: "sub-1",
      iss: "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_TestPool1",
      aud: "test-client-id",
      exp: now + 900,
      iat: now,
      email: "donante1@aqp-solidaria.test",
      "cognito:groups": ["DONANTE"],
    },
  });
  const signinCallback = vi.fn(async (url: string) => {
    // El código de Cognito es de un solo uso: sin `code` en la URL, el canje falla.
    if (!url.includes("code=")) throw new Error("No matching state found in storage");
    setTimeout(() => onLoaded.forEach((listener) => listener(user)), 0);
    return user;
  });
  const manager = {
    events: {
      addUserLoaded: (listener: (user: User) => void) => {
        onLoaded.push(listener);
        return () => {};
      },
      addUserUnloaded: () => () => {},
      addAccessTokenExpired: () => () => {},
    },
    getUser: async () => null,
    signinCallback,
  };
  return { manager: manager as unknown as UserManager, signinCallback };
}

describe("retorno del login (/callback)", () => {
  it("usa siempre la URL con la que se abrió, aunque el efecto se repita después de navegar", async () => {
    // Error real encontrado en Edge: el router cambia la URL a "/" y, antes de desmontar esta
    // página, llega la actualización de la sesión; el efecto se repetía con la URL nueva, sin
    // `code`, y el segundo canje fallaba.
    window.history.replaceState({}, "", "/callback?code=abc&state=xyz");
    const exchange = vi.fn((url: string) => {
      void url;
      return new Promise<string>(() => {});
    });
    const router = createBrowserRouter(routes);
    const tree = (value: ReturnType<typeof anonymous>) => (
      <QueryClientProvider client={new QueryClient()}>
        <ApiContext value={createApiClient(API_URL, fakeApi({}).fetch)}>
          <AuthContext value={value}>
            <RouterProvider router={router} />
          </AuthContext>
        </ApiContext>
      </QueryClientProvider>
    );

    const { rerender } = render(tree(anonymous({ completeSignIn: (url) => exchange(url) })));
    await screen.findByText("Completando el inicio de sesión…");

    window.history.replaceState({}, "", "/");
    rerender(tree(anonymous({ completeSignIn: (url) => exchange(url) })));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(exchange.mock.calls.length).toBeGreaterThan(0);
    for (const [url] of exchange.mock.calls) expect(url).toContain("code=abc");
  });

  it("canjea el código una sola vez y se queda en la ruta de destino", async () => {
    window.history.replaceState({}, "", "/callback?code=abc&state=xyz");
    const { manager, signinCallback } = stubUserManager();
    const api = fakeApi({ "GET /v1/projects": () => json(200, { items: [] }) });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ApiContext value={createApiClient(API_URL, api.fetch)}>
          <AuthProvider service={new AuthService(manager, config)}>
            <RouterProvider router={createBrowserRouter(routes)} />
          </AuthProvider>
        </ApiContext>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Proyectos sociales" }),
    ).toBeVisible();
    // Deja correr cualquier efecto pendiente: no debe volver a /callback con un error.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(screen.queryByText("No se pudo iniciar sesión")).toBeNull();
    expect(signinCallback).toHaveBeenCalledOnce();
  });
});
