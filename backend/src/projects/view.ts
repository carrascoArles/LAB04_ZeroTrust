import type { NativeAttributeValue } from "@aws-sdk/lib-dynamodb";

type Item = Record<string, NativeAttributeValue>;

/** Vista pública de un proyecto. Lista explícita: no incluye datos de donantes. */
export function projectView(item: Item) {
  return {
    projectId: item.projectId,
    title: item.title,
    description: item.description,
    goalAmountCents: item.goalAmountCents,
    confirmedAmountCents: item.confirmedAmountCents,
    currency: item.currency,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
