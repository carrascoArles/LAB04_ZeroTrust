import { readFileSync } from "node:fs";
import { parse } from "yaml";

const scalar = (tag: string) => ({
  tag: `!${tag}`,
  resolve: (value: string) => ({ [tag]: value }),
});
const seq = (tag: string) => ({
  tag: `!${tag}`,
  collection: "seq" as const,
  resolve: (value: { toJSON: () => unknown }) => ({ [tag]: value.toJSON() }),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
export const template: any = parse(
  readFileSync(new URL("../../../infra/template.yaml", import.meta.url), "utf8"),
  { customTags: [scalar("Ref"), scalar("Sub"), scalar("GetAtt"), seq("Equals")] },
);
export const contract: any = parse(
  readFileSync(new URL("../../../docs/api.yaml", import.meta.url), "utf8"),
);

export const resources: Record<string, any> = template.Resources;
export const functions = Object.fromEntries(
  Object.entries(resources).filter(([, r]) => r.Type === "AWS::Serverless::Function"),
) as Record<string, any>;
export const tables = Object.fromEntries(
  Object.entries(resources).filter(([, r]) => r.Type === "AWS::DynamoDB::Table"),
) as Record<string, any>;

export interface GrantedAccess {
  action: string;
  resource: string;
}

/** Permisos DynamoDB de una función, como pares acción y recurso lógico. */
export function grantsOf(functionName: string): GrantedAccess[] {
  const grants: GrantedAccess[] = [];
  for (const policy of functions[functionName].Properties.Policies) {
    for (const statement of policy.Statement) {
      const list = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
      for (const action of statement.Action) {
        for (const resource of list) {
          grants.push({ action, resource: logicalResource(resource) });
        }
      }
    }
  }
  return grants;
}

function logicalResource(resource: any): string {
  if (typeof resource === "string") return resource;
  if (resource.GetAtt) return String(resource.GetAtt).replace(".Arn", "");
  if (resource.Sub) return String(resource.Sub).replace("${", "").replace(".Arn}", "");
  throw new Error(`Recurso no reconocido: ${JSON.stringify(resource)}`);
}
