import { useDeferredValue, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { ProjectCard } from "../components/ProjectCard";
import { TextField } from "../components/Field";
import { countLabel } from "../domain/labels";
import { useProjects } from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function resultsLabel(visible: number, total: number): string {
  if (visible === total) return countLabel(total, "proyecto publicado", "proyectos publicados");
  const verb = visible === 1 ? "coincide" : "coinciden";
  return `${visible} de ${total} proyectos ${verb} con la búsqueda`;
}

/** Catálogo público de proyectos PUBLICADO con su avance (HU-01, HU-09). */
export function CatalogPage() {
  usePageTitle("Proyectos");
  const projects = useProjects();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const all = projects.data ?? [];
  const query = normalize(deferredSearch.trim());
  const visible = query ? all.filter((p) => normalize(p.title).includes(query)) : all;

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Proyectos sociales</h1>
        <p className="text-slate-700">
          Elige una causa y registra una donación simulada. Las cifras muestran solo los montos
          confirmados.
        </p>
      </div>

      {projects.isPending && <Loading label="Cargando proyectos…" />}

      {projects.isError && (
        <ErrorMessage error={projects.error} onRetry={() => void projects.refetch()} />
      )}

      {projects.isSuccess && all.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-400 bg-white p-6 text-center text-slate-700">
          Todavía no hay proyectos publicados. Vuelve pronto.
        </p>
      )}

      {projects.isSuccess && all.length > 0 && (
        <>
          <div className="max-w-md">
            <TextField
              label="Buscar proyecto por título"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <output className="block text-sm text-slate-700">
            {resultsLabel(visible.length, all.length)}
          </output>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((project) => (
              <li key={project.projectId}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
