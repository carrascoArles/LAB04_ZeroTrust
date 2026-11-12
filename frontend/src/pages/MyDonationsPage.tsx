import { Link } from "react-router";
import { Button } from "../components/Button";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { RequireRole } from "../components/RequireRole";
import { SimulationPanel } from "../components/SimulationPanel";
import { StatusBadge } from "../components/StatusBadge";
import { countLabel, formatDateTime } from "../domain/labels";
import { formatCents } from "../domain/money";
import { useMyDonations, useProjects } from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";
import type { Donation } from "../services/schemas";

function DonationItem({
  donation,
  projectTitle,
}: Readonly<{ donation: Donation; projectTitle?: string }>) {
  return (
    <article className="space-y-3 rounded-lg border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          <Link to={`/proyectos/${donation.projectId}`} className="underline underline-offset-4">
            {projectTitle ?? "Proyecto"}
          </Link>
        </h2>
        <StatusBadge status={donation.status} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-700">Monto</dt>
        <dd className="font-semibold text-slate-900">{formatCents(donation.amountCents)}</dd>
        <dt className="text-slate-700">Fecha</dt>
        <dd className="text-slate-900">{formatDateTime(donation.createdAt)}</dd>
        <dt className="text-slate-700">Identificador</dt>
        <dd className="font-mono text-xs break-all text-slate-900">{donation.donationId}</dd>
      </dl>
      {donation.status === "PENDIENTE_SIMULACION" && <SimulationPanel donation={donation} />}
    </article>
  );
}

function DonationHistory() {
  const donations = useMyDonations();
  // Títulos del catálogo público; un proyecto despublicado se muestra sin título.
  const projects = useProjects();
  const titles = new Map(projects.data?.map((p) => [p.projectId, p.title]));

  if (donations.isPending) return <Loading label="Cargando tu historial…" />;
  if (donations.isError) {
    return <ErrorMessage error={donations.error} onRetry={() => void donations.refetch()} />;
  }
  if (donations.data.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-400 bg-white p-6 text-center text-slate-700">
        Aún no registras donaciones.{" "}
        <Link to="/" className="font-medium text-emerald-800 underline">
          Explora los proyectos
        </Link>
        .
      </p>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <output className="block text-sm text-slate-700">
          {countLabel(donations.data.length, "donación simulada", "donaciones simuladas")}
        </output>
        <Button
          variant="secondary"
          onClick={() => void donations.refetch()}
          busy={donations.isFetching}
        >
          Actualizar
        </Button>
      </div>
      <ul className="space-y-4">
        {donations.data.map((donation) => (
          <li key={donation.donationId}>
            <DonationItem donation={donation} projectTitle={titles.get(donation.projectId)} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Historial propio (HU-07): el backend filtra por el `sub` del token, no por un parámetro. */
export function MyDonationsPage() {
  usePageTitle("Mis donaciones");
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Mis donaciones</h1>
        <p className="text-slate-700">Solo ves las donaciones simuladas de tu cuenta.</p>
      </div>
      <RequireRole role="DONANTE">
        <DonationHistory />
      </RequireRole>
    </>
  );
}
