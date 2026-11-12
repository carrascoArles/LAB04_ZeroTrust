import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  type CreateTableCommandInput,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach } from "vitest";
import { setDbClient, type DbClient } from "../../src/shared/db.js";
import { FakeDynamo } from "./fake-dynamodb.js";
import { tables } from "./template.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RecordedOperation {
  action: string;
  resource: string;
}

export const operations: RecordedOperation[] = [];
export let client: DbClient;

/** Traduce un comando a las acciones IAM que exige, tal como las evalúa AWS. */
function recordOperations(command: any): void {
  const input = command.input;
  const add = (action: string, table: string, index?: string) =>
    operations.push({ action, resource: index ? `${table}/index/${index}` : table });
  switch (command.constructor.name) {
    case "GetCommand":
      return void add("dynamodb:GetItem", input.TableName);
    case "PutCommand":
      return void add("dynamodb:PutItem", input.TableName);
    case "QueryCommand":
      return void add("dynamodb:Query", input.TableName, input.IndexName);
    case "TransactWriteCommand":
      for (const op of input.TransactItems) {
        if (op.Put) add("dynamodb:PutItem", op.Put.TableName);
        if (op.Update) add("dynamodb:UpdateItem", op.Update.TableName);
        if (op.ConditionCheck) add("dynamodb:ConditionCheckItem", op.ConditionCheck.TableName);
      }
      return;
    default:
      throw new Error(`Comando sin mapeo IAM: ${command.constructor.name}`);
  }
}

function recording(inner: { send: (command: any) => Promise<any> }): DbClient {
  return {
    send: (command: any) => {
      recordOperations(command);
      return inner.send(command);
    },
  } as DbClient;
}

const endpoint = process.env.DYNAMODB_ENDPOINT;
export const usingRealEngine = Boolean(endpoint);

const realClient = endpoint
  ? new DynamoDBClient({
      endpoint,
      region: "us-east-2",
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    })
  : undefined;

async function recreateTables(raw: DynamoDBClient): Promise<void> {
  const { TableNames = [] } = await raw.send(new ListTablesCommand({}));
  await Promise.all(TableNames.map((TableName) => raw.send(new DeleteTableCommand({ TableName }))));
  await Promise.all(
    Object.entries(tables).map(([TableName, table]) => {
      const { AttributeDefinitions, KeySchema, GlobalSecondaryIndexes } = table.Properties;
      const input: CreateTableCommandInput = {
        TableName,
        AttributeDefinitions,
        KeySchema,
        GlobalSecondaryIndexes,
        BillingMode: "PAY_PER_REQUEST",
      };
      return raw.send(new CreateTableCommand(input));
    }),
  );
}

/** Da a cada prueba una base vacía: en memoria, o en DynamoDB Local si hay DYNAMODB_ENDPOINT. */
export function useDatabase(): void {
  beforeEach(async () => {
    operations.length = 0;
    if (realClient) {
      await recreateTables(realClient);
      client = recording(
        DynamoDBDocumentClient.from(realClient, {
          marshallOptions: { removeUndefinedValues: true },
        }),
      );
    } else {
      client = recording(new FakeDynamo());
    }
    setDbClient(client);
  });
}
