import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABEL, type Role } from "../auth/roles";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { SignInButton } from "./SignInButton";

interface NavItem {
  to: string;
  label: string;
  /** Solo para decidir qué enlaces mostrar; el API autoriza cada solicitud. */
  role?: Role;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Proyectos" },
  { to: "/mis-donaciones", label: "Mis donaciones", role: "DONANTE" },
  { to: "/gestion", label: "Gestión", role: "GESTOR" },
  { to: "/auditoria", label: "Auditoría", role: "AUDITOR" },
];

const CONTAINER = "mx-auto w-full max-w-5xl px-4";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = "inline-flex min-h-11 items-center rounded-md px-3 font-medium";
  return isActive
    ? `${base} bg-emerald-50 text-emerald-900 underline decoration-2 underline-offset-4`
    : `${base} text-slate-800 hover:bg-slate-100`;
}

function SessionControls() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return <SignInButton />;

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-slate-800">
        <span className="sr-only">Sesión iniciada como </span>
        <span className="font-medium break-all">{user.email ?? "usuario"}</span>
        {user.roles.length > 0 && (
          <span> · {user.roles.map((role) => ROLE_LABEL[role]).join(", ")}</span>
        )}
      </p>
      <Button variant="secondary" onClick={handleSignOut} busy={signingOut}>
        Cerrar sesión
      </Button>
    </div>
  );
}

export function Layout() {
  const { user, hasRole, sessionExpired } = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Al cambiar de pantalla, el foco va al contenido para que el lector de pantalla lo anuncie.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.role || hasRole(item.role));

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only rounded-md bg-white px-4 py-2 font-semibold text-emerald-900 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10"
      >
        Saltar al contenido
      </a>

      <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
        <strong>Prototipo académico:</strong> las donaciones son simuladas y no se realiza ningún
        cobro.
      </p>

      <header className="border-b border-slate-300 bg-white">
        <div
          className={`${CONTAINER} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3`}
        >
          <Link to="/" className="text-xl font-bold text-emerald-800">
            AQP-SOLIDARIA
          </Link>
          <SessionControls />
        </div>
        <nav aria-label="Principal" className={CONTAINER}>
          <ul className="flex flex-wrap gap-1 pb-2">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === "/"} className={navLinkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main
        id="contenido"
        ref={mainRef}
        tabIndex={-1}
        className={`${CONTAINER} flex-1 space-y-6 py-6 focus:outline-none`}
      >
        {sessionExpired && !user && (
          <Alert tone="warning" title="Tu sesión expiró">
            <p>Por seguridad, la sesión dura poco. Vuelve a iniciar sesión para continuar.</p>
            <SignInButton />
          </Alert>
        )}
        <Outlet />
      </main>

      <footer className="border-t border-slate-300 bg-white py-4 text-sm text-slate-700">
        <div className={`${CONTAINER} space-y-1`}>
          <p>
            AQP-SOLIDARIA es un prototipo académico (Laboratorio 4, EPIS-UNSA). No solicita ni
            guarda datos de tarjetas, cuentas bancarias ni DNI.
          </p>
          <p>
            Un despliegue real exigiría una evaluación legal según la Ley N.º 29733 de Protección de
            Datos Personales, además de políticas de privacidad y retención.
          </p>
        </div>
      </footer>
    </div>
  );
}
