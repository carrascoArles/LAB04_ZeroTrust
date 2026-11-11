export function Loading({ label = "Cargando…" }: Readonly<{ label?: string }>) {
  return (
    <output className="flex items-center gap-3 py-6 text-slate-700">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent"
      />
      {label}
    </output>
  );
}
