import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/Alert";
import { Loading } from "../components/Loading";
import { SignInButton } from "../components/SignInButton";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * Retorno de Cognito: canjea el código (PKCE) y sale de esta URL con `replace`, para que el
 * `code` no quede en el historial ni en capturas.
 */
export function CallbackPage() {
  usePageTitle("Iniciando sesión");
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  // Se lee una sola vez: si el efecto se repite después de navegar (llega la sesión mientras el
  // router ya cambió la URL), debe volver a pedir el mismo canje, no uno sin `code`.
  const [callbackUrl] = useState(() => window.location.href);

  useEffect(() => {
    let active = true;
    completeSignIn(callbackUrl)
      .then((returnTo) => {
        if (active) void navigate(returnTo, { replace: true });
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        void navigate("/callback", { replace: true });
      });
    return () => {
      active = false;
    };
  }, [callbackUrl, completeSignIn, navigate]);

  if (!failed) return <Loading label="Completando el inicio de sesión…" />;

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">No se pudo iniciar sesión</h1>
      <Alert tone="error" title="El inicio de sesión no se completó.">
        <p>
          El enlace pudo haber vencido o ya se usó. Cierra las ventanas privadas abiertas e
          inténtalo de nuevo.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SignInButton label="Intentar de nuevo" />
          <Link to="/" className="font-medium text-emerald-800 underline">
            Volver al catálogo
          </Link>
        </div>
      </Alert>
    </>
  );
}
