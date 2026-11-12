import { MetadataService, OidcClient, User, type UserManager } from "oidc-client-ts";
import { describe, expect, it, vi } from "vitest";
import { AuthService, safeReturnTo } from "../src/auth/AuthService";
import { createUserManager } from "../src/auth/oidc";
import { rolesFromClaim } from "../src/auth/roles";
import { LOGIN_SCOPES, loadConfig } from "../src/config/env";

const config = loadConfig(
  {
    VITE_API_URL: "https://api.example.test/academic",
    VITE_COGNITO_DOMAIN: "https://auth.example.test",
    VITE_USER_POOL_ID: "us-east-2_TestPool1",
    VITE_CLIENT_ID: "test-client-id",
  },
  "http://localhost:5173",
);

function aUser() {
  const now = Math.floor(Date.now() / 1000);
  return new User({
    access_token: "access",
    refresh_token: "refresh-123",
    id_token: "id",
    token_type: "Bearer",
    expires_at: now + 900,
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
}

describe("createUserManager", () => {
  it("guarda los tokens solo en memoria, nunca en localStorage (CA-NF11.1)", async () => {
    const manager = createUserManager(config, sessionStorage);
    await manager.storeUser(aUser());

    expect((await manager.getUser())?.access_token).toBe("access");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("pide Authorization Code + PKCE S256 con los scopes del API (CA-03.1)", async () => {
    const manager = createUserManager(config, sessionStorage);
    const client = new OidcClient(manager.settings, new MetadataService(manager.settings));

    const request = await client.createSigninRequest({ state: { returnTo: "/mis-donaciones" } });
    const url = new URL(request.url);

    expect(`${url.origin}${url.pathname}`).toBe("https://auth.example.test/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(url.searchParams.get("scope")).toBe(LOGIN_SCOPES);
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/callback");
    // El estado temporal del login va a sessionStorage; localStorage queda vacío.
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });
});

describe("AuthService.signOut (CA-03.3)", () => {
  function setup(fetchImpl: typeof fetch) {
    const manager = createUserManager(config, sessionStorage);
    const redirect = vi.fn();
    const service = new AuthService(manager, config, { fetch: fetchImpl, redirect });
    return { manager, redirect, service };
  }

  it("revoca el refresh token, borra la sesión y cierra la sesión de Cognito", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const { manager, redirect, service } = setup(fetchImpl as unknown as typeof fetch);
    await manager.storeUser(aUser());

    await service.signOut();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://auth.example.test/oauth2/revoke");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      token: "refresh-123",
      client_id: "test-client-id",
    });
    expect(await manager.getUser()).toBeNull();
    expect(redirect).toHaveBeenCalledWith(
      "https://auth.example.test/logout?client_id=test-client-id&logout_uri=http%3A%2F%2Flocalhost%3A5173%2F",
    );
  });

  it("si la revocación falla por red, igual borra la sesión local", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { manager, redirect, service } = setup(failing as unknown as typeof fetch);
    await manager.storeUser(aUser());

    await service.signOut();

    expect(await manager.getUser()).toBeNull();
    expect(redirect).toHaveBeenCalledOnce();
  });
});

describe("AuthService.completeSignIn", () => {
  it("canjea el código una sola vez aunque el callback se monte dos veces (StrictMode)", async () => {
    const signinCallback = vi.fn(async () => ({ state: { returnTo: "/mis-donaciones" } }));
    const service = new AuthService({ signinCallback } as unknown as UserManager, config);
    const url = "http://localhost:5173/callback?code=abc&state=xyz";

    const [first, second] = await Promise.all([
      service.completeSignIn(url),
      service.completeSignIn(url),
    ]);

    expect(signinCallback).toHaveBeenCalledOnce();
    expect(first).toBe("/mis-donaciones");
    expect(second).toBe("/mis-donaciones");
  });
});

describe("safeReturnTo", () => {
  it.each([
    ["/mis-donaciones", "/mis-donaciones"],
    ["/proyectos/abc?x=1", "/proyectos/abc?x=1"],
    ["https://malicioso.example", "/"],
    ["//malicioso.example", "/"],
    ["/\\malicioso.example", "/"],
    ["/callback?code=1", "/"],
    [undefined, "/"],
  ])("%j → %j", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });
});

describe("rolesFromClaim", () => {
  it("solo reconoce los grupos del sistema", () => {
    expect(rolesFromClaim(["GESTOR", "ADMIN"])).toEqual(["GESTOR"]);
    expect(rolesFromClaim("DONANTE")).toEqual([]);
    expect(rolesFromClaim(undefined)).toEqual([]);
  });
});
