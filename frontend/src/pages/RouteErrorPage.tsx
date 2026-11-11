/** Último recurso ante un error de renderizado: sin detalles técnicos para la persona. */
export function RouteErrorPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
      <p className="text-sm font-semibold text-amber-900">AQP-SOLIDARIA · Prototipo académico</p>
      <h1 className="text-2xl font-bold text-slate-900">Algo salió mal</h1>
      <p className="text-slate-700">Recarga la página. Si el problema sigue, avísale al equipo.</p>
      <a
        href="/"
        className="inline-flex min-h-11 items-center font-medium text-emerald-800 underline"
      >
        Volver al inicio
      </a>
    </main>
  );
}
