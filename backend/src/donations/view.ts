import type { NativeAttributeValue } from "@aws-sdk/lib-dynamodb";

type Item = Record<string, NativeAttributeValue>;

/** Vista de una donación para su propietario. Lista explícita: no incluye donorSub. */
export function donationView(item: Item) {
  return {
    donationId: item.donationId,
    projectId: item.projectId,
    amountCents: item.amountCents,
    currency: item.currency,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
