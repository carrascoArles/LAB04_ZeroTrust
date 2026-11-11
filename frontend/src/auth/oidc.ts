import { InMemoryWebStorage, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { LOGIN_SCOPES, type AppConfig } from "../config/env";

/**
 * Client público de Cognito con Authorization Code + PKCE (CA-03.1).
 *
 * - `userStore` en memoria: access, ID y refresh token nunca tocan localStorage (CA-NF11.1).
 * - `stateStore` en sessionStorage: solo `state` y `code_verifier` mientras se va y vuelve de
 *   Cognito; oidc-client-ts los borra al procesar el callback (research.md F3).
 * - Metadatos declarados: no hace falta la solicitud de descubrimiento y quedan explícitos los
 *   dominios que la CSP debe permitir.
 */
export function createUserManager(config: AppConfig, stateStorage: Storage): UserManager {
  const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
  return new UserManager({
    authority: issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: LOGIN_SCOPES,
    metadata: {
      issuer,
      authorization_endpoint: `${config.cognitoDomain}/oauth2/authorize`,
      token_endpoint: `${config.cognitoDomain}/oauth2/token`,
      userinfo_endpoint: `${config.cognitoDomain}/oauth2/userInfo`,
      revocation_endpoint: `${config.cognitoDomain}/oauth2/revoke`,
      end_session_endpoint: `${config.cognitoDomain}/logout`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
    },
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: stateStorage }),
    // Renueva con el refresh token (en memoria) antes de que venza el access token de 15 min.
    automaticSilentRenew: true,
    loadUserInfo: false,
    monitorSession: false,
  });
}
