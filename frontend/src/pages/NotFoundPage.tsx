import { Link } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";

export function NotFoundPage() {
  usePageTitle("Página no encontrada");
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="text-slate-700">La dirección que abriste no existe.</p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center font-medium text-emerald-800 underline"
      >
        Ir al catálogo
      </Link>
    </>
  );
}
