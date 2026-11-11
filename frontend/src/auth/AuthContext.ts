import { createContext, useContext } from "react";
import type { Role } from "./roles";

export interface SessionUser {
  sub: string;
  email?: string;
  roles: Role[];
}

export interface AuthContextValue {
  user: SessionUser | null;
  /** Access token en memoria. Solo lo usan los hooks de datos, nunca los componentes. */
  accessToken: string | null;
  /** La sesión venció sin poder renovarse. */
  sessionExpired: boolean;
  hasRole(role: Role): boolean;
  signIn(returnTo?: string): Promise<void>;
  signOut(): Promise<void>;
  completeSignIn(url: string): Promise<string>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return value;
}
