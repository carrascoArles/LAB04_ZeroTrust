import { Link, useParams } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABEL } from "../auth/roles";
import { Alert } from "../components/Alert";
import { DonationForm } from "../components/DonationForm";
import { ErrorMessage } from "../components/ErrorMessage";
import { FundingProgress } from "../components/FundingProgress";
import { Loading } from "../components/Loading";
import { SignInButton } from "../components/SignInButton";
import { StatusBadge } from "../components/StatusBadge";
import { formatCents } from "../domain/money";
import { useProject, useProjectStats } from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";
import { ApiError } from "../services/errors";

function DonateSection({ projectId }: Readonly<{ projectId: string }>) {
  const { user, hasRole } = useAuth();

  if (!user) {
    return (
      <Alert tone="info" title="Inicia sesión para donar">
        <p>Las donaciones simuladas requieren una cuenta con el rol Donante.</p>
        <SignInButton />
      </Alert>
    );
  }
  if (!hasRole("DONANTE")) {
    const roles = user.roles.map((role) => ROLE_LABEL[role]).join(", ") || "sin rol";
    return (
      <Alert tone="info" title="Tu cuenta no puede donar">
        <p>Solo las cuentas con el rol Donante registran donaciones. Tu cuenta tiene: {roles}.</p>
      </Alert>
    );
  }
  return <DonationForm projectId={projectId} />;
}

/** Detalle de un proyecto PUBLICADO (HU-02) con su avance agregado (HU-09). */
export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  const stats = useProjectStats(projectId);
  usePageTitle(project.data?.title ?? "Proyecto");

  const backLink = (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center font-medium text-emerald-800 underline"
    >
      ← Volver al catálogo
    </Link>
  );

  if (project.isPending) return <Loading label="Cargando proyecto…" />;

  if (project.isError) {
    const notFound = project.error instanceof ApiError && project.error.status === 404;
    return (
      <>
        {backLink}
        <h1 className="text-2xl font-bold text-slate-900">
          {notFound ? "Proyecto no encontrado" : "No se pudo cargar el proyecto"}
        </h1>
        {notFound ? (
          <p className="text-slate-700">Este proyecto no existe o todavía no está publicado.</p>
        ) : (
          <ErrorMessage error={project.error} onRetry={() => void project.refetch()} />
        )}
      </>
    );
  }

  const { projectId: id, title, description, status } = project.data;
  // Las cifras de /stats son las más recientes; mientras cargan se usan las del detalle.
  const figures = stats.data ?? project.data;

  return (
    <>
      {backLink}
      <article className="space-y-4">
        <h1 className="text-2xl font-bold break-words text-slate-900 sm:text-3xl">{title}</h1>
        <p className="whitespace-pre-line text-slate-800">{description}</p>
        {/* CA-02.1: identificador, objetivo, estado y monto acumulado, sin datos de donantes. */}
        <dl
          role="group"
          aria-label="Datos del proyecto"
          className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-slate-300 bg-white p-4 text-sm"
        >
          <dt className="text-slate-700">Identificador</dt>
          <dd className="font-mono text-xs break-all text-slate-900">{id}</dd>
          <dt className="text-slate-700">Estado</dt>
          <dd>
            <StatusBadge status={status} />
          </dd>
          <dt className="text-slate-700">Objetivo</dt>
          <dd className="font-semibold text-slate-900">{formatCents(figures.goalAmountCents)}</dd>
          <dt className="text-slate-700">Monto confirmado</dt>
          <dd className="font-semibold text-slate-900">
            {formatCents(figures.confirmedAmountCents)}
          </dd>
        </dl>
        <section
          aria-labelledby="avance"
          className="rounded-lg border border-slate-300 bg-white p-4"
        >
          <h2 id="avance" className="mb-2 text-lg font-semibold text-slate-900">
            Avance confirmado
          </h2>
          <FundingProgress
            confirmedCents={figures.confirmedAmountCents}
            goalCents={figures.goalAmountCents}
          />
        </section>
      </article>

      <section aria-labelledby="donar" className="space-y-3">
        <h2 id="donar" className="text-xl font-semibold text-slate-900">
          Donar (simulado)
        </h2>
        <DonateSection projectId={project.data.projectId} />
      </section>
    </>
  );
}
