import { z } from "zod";
import { notFound } from "./errors.js";

/** Los esquemas son estrictos: un campo no previsto, como donorSub, se rechaza. */
export const createProjectSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  goalAmountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const createDonationSchema = z.strictObject({
  projectId: z.uuid(),
  amountCents: z.number().int().min(100).max(100_000),
});

export const simulateSchema = z.strictObject({
  outcome: z.enum(["CONFIRMADA_SIMULADA", "RECHAZADA_SIMULADA"]),
});

export const idempotencyKeySchema = z.uuid();

export const auditQuerySchema = z.object({
  eventType: z.string().min(1).max(64),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

/** Un identificador mal formado no puede existir: responde igual que uno inexistente. */
export function resourceId(value: string | undefined): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw notFound();
  return parsed.data;
}
