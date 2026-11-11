import { z } from "zod";

/** Scopes que pide la SPA. El rol no lo da el scope sino el grupo, que decide el backend. */
export const LOGIN_SCOPES =
  "openid email api/projects.write api/donations.write api/donations.read api/audit.read";

export interface AppConfig {
  apiUrl: string;
  cognitoDomain: string;
  userPoolId: string;
  region: string;
  clientId: string;
  redirectUri: string;
  logoutUri: string;
}

const httpsUrl = z.url({ protocol: /^https$/ }).transform((url) => url.replace(/\/+$/, ""));
const optionalUrl = z
  .union([z.literal(""), z.url({ protocol: /^https?$/ })])
  .optional()
  .transform((url) => url || undefined);

const envSchema = z.object({
  VITE_API_URL: httpsUrl,
  VITE_COGNITO_DOMAIN: httpsUrl,
  VITE_USER_POOL_ID: z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d_[A-Za-z0-9]+$/),
  VITE_CLIENT_ID: z.string().min(1),
  VITE_REDIRECT_URI: optionalUrl,
});

export class ConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Configuración incompleta: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

/**
 * Valida las variables VITE_* y deriva el resto. Sin VITE_REDIRECT_URI, la URI de retorno sale
 * del origen actual: Cognito solo acepta las URI registradas, así que no abre una redirección.
 */
export function loadConfig(env: Record<string, unknown>, origin: string): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  }
  const vars = parsed.data;
  const redirectUri = vars.VITE_REDIRECT_URI ?? `${origin}/callback`;
  return {
    apiUrl: vars.VITE_API_URL,
    cognitoDomain: vars.VITE_COGNITO_DOMAIN,
    userPoolId: vars.VITE_USER_POOL_ID,
    region: vars.VITE_USER_POOL_ID.split("_")[0] ?? "",
    clientId: vars.VITE_CLIENT_ID,
    redirectUri,
    // Debe coincidir con LogoutURLs del app client: el origen con "/" final.
    logoutUri: `${new URL(redirectUri).origin}/`,
  };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= loadConfig(import.meta.env, window.location.origin);
  return cached;
}
