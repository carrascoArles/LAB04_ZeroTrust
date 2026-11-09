import { createHash, randomUUID } from "node:crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { auditPut } from "../audit/record.js";
import { authorize } from "../authz/index.js";
import {
  cancellationCodes,
  db,
  isTransactionCanceled,
  table,
  transactWrite,
} from "../shared/db.js";
import { badRequest, conflict, notFound } from "../shared/errors.js";
import { header, parseBody, route, type RouteResult } from "../shared/http.js";
import { createDonationSchema, idempotencyKeySchema } from "../shared/schemas.js";
import { donationView } from "./view.js";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const nowInSeconds = () => Math.floor(Date.now() / 1000);

const notPublished = () => conflict("PROJECT_NOT_PUBLISHED", "El proyecto no acepta donaciones.");

/**
 * Si la clave ya se usó, devuelve el resultado original o 409 si la carga es otra (CA-05.4).
 * Una clave vencida cuenta como libre: DynamoDB puede tardar en borrar por TTL.
 */
async function replayIfKeyUsed(pk: string, payloadHash: string): Promise<RouteResult | undefined> {
  const { Item: record } = await db().send(
    new GetCommand({ TableName: table("IDEMPOTENCY_TABLE"), Key: { pk }, ConsistentRead: true }),
  );
  if (!record || record.expiresAt <= nowInSeconds()) return undefined;
  if (record.payloadHash !== payloadHash) {
    throw conflict("IDEMPOTENCY_KEY_REUSED", "La clave ya se usó con otros datos.");
  }
  const { Item: donation } = await db().send(
    new GetCommand({
      TableName: table("DONATIONS_TABLE"),
      Key: { donationId: record.donationId },
      ConsistentRead: true,
    }),
  );
  if (!donation) throw new Error("Registro de idempotencia sin donación");
  return { status: record.responseStatus, body: donationView(donation) };
}

/** POST /v1/donations: intención simulada e idempotente; solo DONANTE (HU-05, AD-05). */
export const handler = route("CreateDonation", async (event, { requestId }) => {
  const { sub } = authorize(event, { group: "DONANTE", scope: "api/donations.write" });

  const key = idempotencyKeySchema.safeParse(header(event, "idempotency-key"));
  if (!key.success) throw badRequest();
  const { projectId, amountCents } = parseBody(event, createDonationSchema);

  const pk = `${sub}#createDonation#${key.data}`;
  const payloadHash = createHash("sha256")
    .update(JSON.stringify({ projectId, amountCents }))
    .digest("hex");

  const replay = await replayIfKeyUsed(pk, payloadHash);
  if (replay) return replay;

  const { Item: project } = await db().send(
    new GetCommand({ TableName: table("PROJECTS_TABLE"), Key: { projectId } }),
  );
  if (!project) throw notFound();
  if (project.status !== "PUBLICADO") throw notPublished();

  const now = new Date().toISOString();
  const donation = {
    donationId: randomUUID(),
    projectId,
    donorSub: sub, // solo desde el token verificado (CA-05.3)
    amountCents,
    currency: "PEN",
    status: "PENDIENTE_SIMULACION",
    createdAt: now,
    updatedAt: now,
  };

  try {
    await transactWrite([
      {
        ConditionCheck: {
          TableName: table("PROJECTS_TABLE"),
          Key: { projectId },
          ConditionExpression: "#status = :published",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":published": "PUBLICADO" },
        },
      },
      {
        Put: {
          TableName: table("IDEMPOTENCY_TABLE"),
          Item: {
            pk,
            payloadHash,
            donationId: donation.donationId,
            responseStatus: 201,
            expiresAt: nowInSeconds() + IDEMPOTENCY_TTL_SECONDS,
          },
          ConditionExpression: "attribute_not_exists(pk) OR expiresAt < :now",
          ExpressionAttributeValues: { ":now": nowInSeconds() },
        },
      },
      {
        Put: {
          TableName: table("DONATIONS_TABLE"),
          Item: donation,
          ConditionExpression: "attribute_not_exists(donationId)",
        },
      },
      auditPut({
        eventType: "DONATION_CREATED",
        action: "CreateDonation",
        actorSub: sub,
        resourceRef: `donation:${donation.donationId}`,
        requestId,
        timestamp: now,
      }),
    ]);
  } catch (error) {
    if (!isTransactionCanceled(error)) throw error;
    // Otra solicitud con la misma clave pudo ganar la carrera: responde con su resultado.
    const winner = await replayIfKeyUsed(pk, payloadHash);
    if (winner) return winner;
    if (cancellationCodes(error)[0] === "ConditionalCheckFailed") throw notPublished();
    throw conflict("CONFLICT", "La solicitud entró en conflicto. Inténtelo de nuevo.");
  }

  return { status: 201, body: donationView(donation) };
});
