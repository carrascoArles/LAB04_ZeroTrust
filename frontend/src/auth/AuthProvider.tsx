import type { User } from "oidc-client-ts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type SessionUser } from "./AuthContext";
import type { AuthService } from "./AuthService";
import { rolesFromClaim } from "./roles";

function toSessionUser(user: User): SessionUser {
  const { sub, email } = user.profile;
  return {
    sub,
    email: typeof email === "string" ? email : undefined,
    roles: rolesFromClaim(user.profile["cognito:groups"]),
  };
}

export function AuthProvider({
  service,
  children,
}: Readonly<{ service: AuthService; children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const { events } = service;
    const removers = [
      events.addUserLoaded((loaded) => {
        setUser(loaded);
        setSessionExpired(false);
      }),
      events.addUserUnloaded(() => setUser(null)),
      events.addAccessTokenExpired(() => {
        setSessionExpired(true);
        void service.clearSession();
      }),
    ];
    void service.getUser().then((current) => setUser(current));
    return () => removers.forEach((remove) => remove());
  }, [service]);

  const value = useMemo<AuthContextValue>(() => {
    const sessionUser = user ? toSessionUser(user) : null;
    return {
      user: sessionUser,
      accessToken: user?.access_token ?? null,
      sessionExpired,
      hasRole: (role) => sessionUser?.roles.includes(role) ?? false,
      signIn: (returnTo = "/") => service.signIn(returnTo),
      signOut: () => service.signOut(),
      completeSignIn: (url) => service.completeSignIn(url),
    };
  }, [service, user, sessionExpired]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
