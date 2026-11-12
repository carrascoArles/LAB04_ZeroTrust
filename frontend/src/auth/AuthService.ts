import type { User, UserManager, UserManagerEvents } from "oidc-client-ts";
import type { AppConfig } from "../config/env";

export interface AuthServiceDeps {
  fetch: typeof fetch;
  /** Navegación de página completa hacia Cognito. */
  redirect: (url: string) => void;
}

const browserDeps: AuthServiceDeps = {
  fetch: (input, init) => fetch(input, init),
  redirect: (url) => window.location.assign(url),
};

/**
 * Acepta solo rutas internas como destino después del login, para que un `returnTo`
 * manipulado no se convierta en una redirección abierta.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string") return "/";
  const isInternal = value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
  if (!isInternal || value.startsWith("/callback")) return "/";
  return value;
}

function returnToFromState(state: unknown): unknown {
  return typeof state === "object" && state !== null && "returnTo" in state
    ? state.returnTo
    : undefined;
}

/** Casos de uso de la sesión sobre oidc-client-ts: entrar, volver de Cognito y salir. */
export class AuthService {
  private pendingCallback?: { url: string; result: Promise<string> };

  constructor(
    private readonly userManager: UserManager,
    private readonly config: AppConfig,
    private readonly deps: AuthServiceDeps = browserDeps,
  ) {}

  get events(): UserManagerEvents {
    return this.userManager.events;
  }

  getUser(): Promise<User | null> {
    return this.userManager.getUser();
  }

  signIn(returnTo: string): Promise<void> {
    return this.userManager.signinRedirect({ state: { returnTo: safeReturnTo(returnTo) } });
  }

  /**
   * Canjea el código una sola vez por URL, aunque React StrictMode monte la página dos veces:
   * el código de Cognito es de un solo uso. Devuelve la ruta interna a la que volver.
   */
  completeSignIn(url: string): Promise<string> {
    if (this.pendingCallback?.url !== url) {
      const result = this.userManager
        .signinCallback(url)
        .then((user) => safeReturnTo(returnToFromState(user?.state)));
      this.pendingCallback = { url, result };
    }
    return this.pendingCallback.result;
  }

  /**
   * Cierre de sesión (CA-03.3): revoca el refresh token, borra los tokens de memoria y cierra
   * la sesión del login administrado, para que el siguiente login no reutilice al usuario.
   */
  async signOut(): Promise<void> {
    const user = await this.userManager.getUser();
    if (user?.refresh_token) await this.revokeRefreshToken(user.refresh_token);
    await this.userManager.removeUser();
    this.deps.redirect(this.logoutUrl());
  }

  /** Borra de memoria una sesión vencida, sin salir de la página. */
  clearSession(): Promise<void> {
    return this.userManager.removeUser();
  }

  logoutUrl(): string {
    const url = new URL(`${this.config.cognitoDomain}/logout`);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("logout_uri", this.config.logoutUri);
    return url.toString();
  }

  /**
   * POST /oauth2/revoke con los parámetros documentados para un client público: `token` y
   * `client_id`. Si falla la red, igual se borra la sesión local: el token deja el navegador.
   */
  private async revokeRefreshToken(token: string): Promise<void> {
    try {
      await this.deps.fetch(`${this.config.cognitoDomain}/oauth2/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token, client_id: this.config.clientId }),
        credentials: "omit",
      });
    } catch {
      // Sin red no hay forma de revocar; el refresh token vence en 1 día (infra/template.yaml).
    }
  }
}
