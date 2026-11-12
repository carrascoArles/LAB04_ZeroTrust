import { useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./Button";

/** Inicia Authorization Code + PKCE y vuelve a la pantalla actual al terminar. */
export function SignInButton({ label = "Iniciar sesión" }: Readonly<{ label?: string }>) {
  const { signIn } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<"idle" | "redirecting" | "failed">("idle");

  const handleClick = async () => {
    setState("redirecting");
    try {
      await signIn(`${location.pathname}${location.search}`);
    } catch {
      setState("failed");
    }
  };

  return (
    <>
      <Button onClick={handleClick} busy={state === "redirecting"}>
        {label}
      </Button>
      {state === "failed" && (
        <p role="alert" className="text-sm text-red-800">
          No se pudo abrir el inicio de sesión. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </>
  );
}
