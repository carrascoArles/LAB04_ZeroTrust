import { z } from "zod";

/**
 * Esquemas de `components.schemas` de docs/api.yaml. Toda respuesta se valida con ellos antes de
 * llegar a la interfaz: si el backend se aparta del contrato, la SPA falla de forma visible.
 * Los objetos no son estrictos porque el contrato admite propiedades adicionales.
 */

const uuid = z.uuid();
const dateTime = z.iso.datetime({ offset: true });
const currency = z.literal("PEN");

export const projectStatusSchema = z.enum(["BORRADOR", "PUBLICADO"]);
export const donationStatusSchema = z.enum([
  "PENDIENTE_SIMULACION",
  "CONFIRMADA_SIMULADA",
  "RECHAZADA_SIMULADA",
]);
export const simulationOutcomeSchema = z.enum(["CONFIRMADA_SIMULADA", "RECHAZADA_SIMULADA"]);

/** ProjectPublic */
export const projectSchema = z.object({
  projectId: uuid,
  title: z.string(),
  description: z.string(),
  goalAmountCents: z.int().min(1),
  confirmedAmountCents: z.int().min(0),
  currency,
  status: projectStatusSchema,
});

/** Respuesta de getProjectStats */
export const projectStatsSchema = z.object({
  projectId: uuid,
  goalAmountCents: z.int().min(1),
  confirmedAmountCents: z.int().min(0),
  currency,
});

/** Donation */
export const donationSchema = z.object({
  donationId: uuid,
  projectId: uuid,
  amountCents: z.int(),
  currency,
  status: donationStatusSchema,
  createdAt: dateTime,
});

/** AuditEvent */
export const auditEventSchema = z.object({
  eventId: z.string(),
  timestamp: dateTime,
  requestId: z.string(),
  actorRef: z.string(),
  action: z.string(),
  resourceRef: z.string(),
  outcome: z.string(),
});

/** Error: respuesta uniforme del backend, sin detalles internos. */
export const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
});

const listOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

export const projectListSchema = listOf(projectSchema);
export const donationListSchema = listOf(donationSchema);
export const auditEventListSchema = listOf(auditEventSchema);

/** CreateProjectRequest (additionalProperties: false) */
export const createProjectRequestSchema = z.strictObject({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  goalAmountCents: z.int().min(1),
});

/** CreateDonationRequest (additionalProperties: false) */
export const createDonationRequestSchema = z.strictObject({
  projectId: uuid,
  amountCents: z.int().min(100).max(100_000),
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectStats = z.infer<typeof projectStatsSchema>;
export type Donation = z.infer<typeof donationSchema>;
export type DonationStatus = z.infer<typeof donationStatusSchema>;
export type SimulationOutcome = z.infer<typeof simulationOutcomeSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateDonationRequest = z.infer<typeof createDonationRequestSchema>;
