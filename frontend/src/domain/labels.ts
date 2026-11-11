import type { DonationStatus, ProjectStatus, SimulationOutcome } from "../services/schemas";

/** Texto exacto que exige CA-06.4. */
export const SIMULATION_NOTICE = "Simulación académica: no se ha realizado ningún cobro";

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  PENDIENTE_SIMULACION: "Pendiente de simulación",
  CONFIRMADA_SIMULADA: "Confirmada (simulada)",
  RECHAZADA_SIMULADA: "Rechazada (simulada)",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  BORRADOR: "Borrador",
  PUBLICADO: "Publicado",
};

export const SIMULATION_OUTCOME_ACTION: Record<SimulationOutcome, string> = {
  CONFIRMADA_SIMULADA: "Simular confirmación",
  RECHAZADA_SIMULADA: "Simular rechazo",
};

/** Tipos que escribe el backend en AuditEvents (spec 001, clarificaciones). */
export const AUDIT_EVENT_TYPES = [
  { value: "DONATION_CREATED", label: "Donación creada" },
  { value: "DONATION_SIMULATED", label: "Donación simulada" },
  { value: "PROJECT_CREATED", label: "Proyecto creado" },
  { value: "PROJECT_PUBLISHED", label: "Proyecto publicado" },
] as const;

/** Cantidad con el sustantivo concordado: «1 evento», «3 eventos». */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const DATE_TIME = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}
