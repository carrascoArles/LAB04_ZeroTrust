import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

export type DbClient = Pick<DynamoDBDocumentClient, "send">;

let client: DbClient | undefined;

export function db(): DbClient {
  client ??= DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return client;
}

/** Permite a las pruebas usar otro motor. */
export function setDbClient(next: DbClient): void {
  client = next;
}

export type TableVariable =
  "PROJECTS_TABLE" | "DONATIONS_TABLE" | "IDEMPOTENCY_TABLE" | "AUDIT_TABLE";

export function table(variable: TableVariable): string {
  const name = process.env[variable];
  if (!name) throw new Error("Falta configuración de tabla");
  return name;
}

export type TransactItems = NonNullable<TransactWriteCommandInput["TransactItems"]>;

export function isTransactionCanceled(error: unknown): boolean {
  return error instanceof Error && error.name === "TransactionCanceledException";
}

/** Motivo de cancelación de cada operación, en el orden en que se enviaron. */
export function cancellationCodes(error: unknown): string[] {
  const reasons = (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons;
  return (reasons ?? []).map((reason) => reason.Code ?? "None");
}

const CONFLICT_ATTEMPTS = 4;

/**
 * Ejecuta una transacción. Si DynamoDB la cancela solo por conflicto con otra en curso, reintenta:
 * ese resultado no significa que la condición haya fallado y aún debe evaluarse.
 */
export async function transactWrite(items: TransactItems): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await db().send(new TransactWriteCommand({ TransactItems: items }));
      return;
    } catch (error) {
      const codes = isTransactionCanceled(error) ? cancellationCodes(error) : [];
      const onlyConflict =
        codes.includes("TransactionConflict") && !codes.includes("ConditionalCheckFailed");
      if (!onlyConflict || attempt >= CONFLICT_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt * Math.random()));
    }
  }
}
