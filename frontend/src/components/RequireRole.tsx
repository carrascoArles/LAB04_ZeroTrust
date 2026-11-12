import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABEL, type Role } from "../auth/roles";
import { Alert } from "./Alert";
import { SignInButton } from "./SignInButton";

/**
 * Guarda de interfaz: solo evita mostrar pantallas inútiles. No es un control de seguridad;
 * el backend rechaza igual con 401 o 403 (constitución, principio II).
 */
export function RequireRole({ role, children }: Readonly<{ role: Role; children: ReactNode }>) {
  const { user, hasRole } = useAuth();
  if (!user) {
    return (
      <Alert tone="info" title="Necesitas iniciar sesión">
        <p>Esta sección es para cuentas con el rol {ROLE_LABEL[role]}.</p>
        <div className="flex flex-wrap items-center gap-2">
          <SignInButton />
        </div>
      </Alert>
    );
  }
  if (!hasRole(role)) {
    return (
      <Alert tone="warning" title="Tu cuenta no tiene acceso a esta sección">
        <p>
          Esta sección es solo para el rol {ROLE_LABEL[role]}. Aunque intentaras usarla, el API
          respondería 403.
        </p>
      </Alert>
    );
  }
  return children;
}
