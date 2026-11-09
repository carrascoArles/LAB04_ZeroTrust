import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { tables } from "./template.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Item = Record<string, any>;
interface Names {
  [k: string]: string;
}
interface Values {
  [k: string]: any;
}

/**
 * Motor DynamoDB en memoria para pruebas sin dependencias. Evalúa las expresiones reales que
 * envían los handlers y falla si encuentra una que no entiende, en lugar de dejarla pasar.
 * Cede el turno antes de cada operación para que las solicitudes concurrentes se intercalen.
 */
export class FakeDynamo {
  private data = new Map<string, Map<string, Item>>();

  constructor() {
    for (const [name] of Object.entries(tables)) this.data.set(name, new Map());
  }

  async send(command: any): Promise<any> {
    await new Promise((resolve) => setImmediate(resolve));
    const input = command.input;
    switch (command.constructor.name) {
      case "GetCommand":
        return { Item: clone(this.table(input.TableName).get(keyOf(input.TableName, input.Key))) };
      case "PutCommand":
        this.assertCondition(input);
        this.put(input.TableName, input.Item);
        return {};
      case "QueryCommand":
        return this.query(input);
      case "TransactWriteCommand":
        return this.transact(input.TransactItems);
      default:
        throw new Error(
          `Operación no soportada por el motor en memoria: ${command.constructor.name}`,
        );
    }
  }

  private table(name: string): Map<string, Item> {
    const table = this.data.get(name);
    if (!table) throw new Error(`ResourceNotFoundException: ${name}`);
    return table;
  }

  private put(tableName: string, item: Item): void {
    this.table(tableName).set(keyOf(tableName, item), clone(item));
  }

  private assertCondition(input: any): void {
    const key = input.Item ?? input.Key;
    const current = this.table(input.TableName).get(keyOf(input.TableName, key));
    if (!evaluate(input.ConditionExpression, current, input)) {
      throw new ConditionalCheckFailedException({ message: "condition failed", $metadata: {} });
    }
  }

  private query(input: any): any {
    const expression: string = input.KeyConditionExpression;
    const between = /^(\S+) = (\S+) AND (\S+) BETWEEN (\S+) AND (\S+)$/.exec(expression);
    const equals = /^(\S+) = (\S+)$/.exec(expression);
    let filter: (item: Item) => boolean;
    let sortKey: string | undefined;
    if (between) {
      const [, hash, hashValue, sort, low, high] = between as unknown as string[];
      sortKey = name(sort!, input.ExpressionAttributeNames);
      const hashName = name(hash!, input.ExpressionAttributeNames);
      const [v, l, h] = [hashValue!, low!, high!].map((k) => input.ExpressionAttributeValues[k]);
      filter = (i) => i[hashName] === v && i[sortKey!] >= l && i[sortKey!] <= h;
    } else if (equals) {
      const hashName = name(equals[1]!, input.ExpressionAttributeNames);
      const value = input.ExpressionAttributeValues[equals[2]!];
      filter = (i) => i[hashName] === value;
    } else {
      throw new Error(`KeyConditionExpression no soportada: ${expression}`);
    }
    const schema = input.IndexName
      ? tables[input.TableName].Properties.GlobalSecondaryIndexes.find(
          (g: any) => g.IndexName === input.IndexName,
        ).KeySchema
      : tables[input.TableName].Properties.KeySchema;
    sortKey ??= schema.find((k: any) => k.KeyType === "RANGE")?.AttributeName;
    const items = [...this.table(input.TableName).values()]
      .filter(filter)
      .sort((a, b) => String(a[sortKey!] ?? "").localeCompare(String(b[sortKey!] ?? "")));
    if (input.ScanIndexForward === false) items.reverse();
    return { Items: (input.Limit ? items.slice(0, input.Limit) : items).map(clone) };
  }

  /** Atómica: evalúa todas las condiciones y solo entonces aplica los cambios. */
  private transact(operations: any[]): any {
    const reasons = operations.map((op) => {
      const body = op.ConditionCheck ?? op.Put ?? op.Update;
      if (!body) throw new Error(`Operación de transacción no soportada: ${JSON.stringify(op)}`);
      const key = body.Item ?? body.Key;
      const current = this.table(body.TableName).get(keyOf(body.TableName, key));
      const ok = !body.ConditionExpression || evaluate(body.ConditionExpression, current, body);
      return { Code: ok ? "None" : "ConditionalCheckFailed" };
    });
    if (reasons.some((r) => r.Code !== "None")) {
      throw new TransactionCanceledException({
        message: "Transaction cancelled",
        $metadata: {},
        CancellationReasons: reasons,
      });
    }
    for (const op of operations) {
      if (op.Put) this.put(op.Put.TableName, op.Put.Item);
      if (op.Update) this.applyUpdate(op.Update);
    }
    return {};
  }

  private applyUpdate(input: any): void {
    const key = keyOf(input.TableName, input.Key);
    const item: Item = { ...this.table(input.TableName).get(key), ...input.Key };
    const expression: string = input.UpdateExpression;
    if (!expression.startsWith("SET "))
      throw new Error(`UpdateExpression no soportada: ${expression}`);
    for (const assignment of expression.slice(4).split(",")) {
      const match = /^\s*(\S+) = (\S+)(?: \+ (\S+))?\s*$/.exec(assignment);
      if (!match) throw new Error(`Asignación no soportada: ${assignment}`);
      const target = name(match[1]!, input.ExpressionAttributeNames);
      if (match[3]) {
        const left = name(match[2]!, input.ExpressionAttributeNames);
        item[target] = item[left] + input.ExpressionAttributeValues[match[3]];
      } else {
        item[target] = input.ExpressionAttributeValues[match[2]!];
      }
    }
    this.put(input.TableName, item);
  }
}

function keyOf(tableName: string, source: Item): string {
  const schema = tables[tableName]?.Properties.KeySchema;
  if (!schema) throw new Error(`ResourceNotFoundException: ${tableName}`);
  return schema.map((k: any) => source[k.AttributeName]).join("|");
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function name(token: string, names: Names | undefined): string {
  if (!token.startsWith("#")) return token;
  const resolved = names?.[token];
  if (!resolved) throw new Error(`Nombre sin definir: ${token}`);
  return resolved;
}

function evaluate(expression: string | undefined, item: Item | undefined, input: any): boolean {
  if (!expression) return true;
  const names: Names | undefined = input.ExpressionAttributeNames;
  const values: Values | undefined = input.ExpressionAttributeValues;
  return expression
    .split(" OR ")
    .some((alternative) =>
      alternative
        .split(" AND ")
        .every((clause) => evaluateClause(clause.trim(), item, names, values)),
    );
}

function evaluateClause(
  clause: string,
  item: Item | undefined,
  names: Names | undefined,
  values: Values | undefined,
): boolean {
  const fn = /^attribute_(not_)?exists\((\S+)\)$/.exec(clause);
  if (fn) {
    const exists = item?.[name(fn[2]!, names)] !== undefined;
    return fn[1] ? !exists : exists;
  }
  const comparison = /^(\S+) (=|<) (:\S+)$/.exec(clause);
  if (!comparison) throw new Error(`Condición no soportada: ${clause}`);
  const left = item?.[name(comparison[1]!, names)];
  const right = values?.[comparison[3]!];
  if (right === undefined) throw new Error(`Valor sin definir: ${comparison[3]}`);
  if (left === undefined) return false;
  return comparison[2] === "=" ? left === right : left < right;
}
