import type { ConfigError } from "../config/env";

/** Se muestra si faltan variables VITE_*; evita una pantalla en blanco. */
export function ConfigErrorPage({ error }: Readonly<{ error: ConfigError }>) {
  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Falta configurar la SPA</h1>
      <p className="text-slate-700">
        Revisa <code>frontend/.env.local</code> (ver <code>.env.example</code>). Variables con
        problemas: {error.missing.join(", ")}.
      </p>
    </main>
  );
}
