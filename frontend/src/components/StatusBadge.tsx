import { DONATION_STATUS_LABEL, PROJECT_STATUS_LABEL } from "../domain/labels";
import type { DonationStatus, ProjectStatus } from "../services/schemas";

const STYLES: Record<DonationStatus | ProjectStatus, string> = {
  PENDIENTE_SIMULACION: "bg-amber-100 text-amber-900 ring-amber-700/40",
  CONFIRMADA_SIMULADA: "bg-emerald-100 text-emerald-900 ring-emerald-700/40",
  RECHAZADA_SIMULADA: "bg-red-100 text-red-900 ring-red-700/40",
  BORRADOR: "bg-slate-100 text-slate-900 ring-slate-700/40",
  PUBLICADO: "bg-emerald-100 text-emerald-900 ring-emerald-700/40",
};

const LABELS: Record<DonationStatus | ProjectStatus, string> = {
  ...DONATION_STATUS_LABEL,
  ...PROJECT_STATUS_LABEL,
};

/** El estado se comunica con texto, no solo con color (WCAG 1.4.1). */
export function StatusBadge({ status }: Readonly<{ status: DonationStatus | ProjectStatus }>) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
