import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { auditPut } from "../audit/record.js";
import { authorize } from "../authz/index.js";
import {
  db,
  isTransactionCanceled,
  table,
  transactWrite,
  type TransactItems,
} from "../shared/db.js";
import { conflict, notFound } from "../shared/errors.js";
import { parseBody, route } from "../shared/http.js";
import { resourceId, simulateSchema } from "../shared/schemas.js";
import { donationView } from "./view.js";

const PENDING = "PENDIENTE_SIMULACION";
const invalidTransition = () =>
  conflict("INVALID_TRANSITION", "La donación ya no está pendiente de simulación.");

/**
 * POST /v1/donations/{donationId}/simulate: solo el propietario y solo en el stage académico
 * (la plantilla no crea la ruta en otro stage). La condición de la transacción garantiza que,
 * entre solicitudes concurrentes, solo una transición cambie el acumulado (CA-06.2).
 */
export const handler = route("SimulateDonation", async (event, { requestId }) => {
  const { sub } = authorize(event, { group: "DONANTE", scope: "api/donations.write" });
  const donationId = resourceId(event.pathParameters?.donationId);
  const { outcome } = parseBody(event, simulateSchema);
  const donationsTable = table("DONATIONS_TABLE");

  const { Item: donation } = await db().send(
    new GetCommand({ TableName: donationsTable, Key: { donationId }, ConsistentRead: true }),
  );
  // Ajena o inexistente responden igual: no se revela que el identificador existe (BOLA).
  if (!donation || donation.donorSub !== sub) throw notFound();
  if (donation.status !== PENDING) throw invalidTransition();

  const now = new Date().toISOString();
  const operations: TransactItems = [
    {
      Update: {
        TableName: donationsTable,
        Key: { donationId },
        UpdateExpression: "SET #status = :outcome, updatedAt = :now",
        ConditionExpression: "#status = :pending AND donorSub = :sub",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":outcome": outcome,
          ":pending": PENDING,
          ":sub": sub,
          ":now": now,
        },
      },
    },
    auditPut({
      eventType: "DONATION_SIMULATED",
      action: "SimulateDonation",
      actorSub: sub,
      resourceRef: `donation:${donationId}`,
      requestId,
      timestamp: now,
    }),
  ];

  if (outcome === "CONFIRMADA_SIMULADA") {
    operations.push({
      Update: {
        TableName: table("PROJECTS_TABLE"),
        Key: { projectId: donation.projectId },
        // El monto sale del registro guardado; el navegador no lo envía.
        UpdateExpression:
          "SET confirmedAmountCents = confirmedAmountCents + :amount, updatedAt = :now",
        ConditionExpression: "attribute_exists(projectId)",
        ExpressionAttributeValues: { ":amount": donation.amountCents, ":now": now },
      },
    });
  }

  try {
    await transactWrite(operations);
  } catch (error) {
    if (isTransactionCanceled(error)) throw invalidTransition();
    throw error;
  }

  return { status: 200, body: donationView({ ...donation, status: outcome, updatedAt: now }) };
});
