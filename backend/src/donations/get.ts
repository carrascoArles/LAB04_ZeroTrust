import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { authorize } from "../authz/index.js";
import { db, table } from "../shared/db.js";
import { notFound } from "../shared/errors.js";
import { route } from "../shared/http.js";
import { resourceId } from "../shared/schemas.js";
import { donationView } from "./view.js";

/** GET /v1/donations/{donationId}: ajena o inexistente responden igual (CA-07.2, T09). */
export const handler = route("GetDonation", async (event) => {
  const { sub } = authorize(event, { group: "DONANTE", scope: "api/donations.read" });
  const donationId = resourceId(event.pathParameters?.donationId);

  const { Item } = await db().send(
    new GetCommand({
      TableName: table("DONATIONS_TABLE"),
      Key: { donationId },
      ConsistentRead: true,
    }),
  );
  if (!Item || Item.donorSub !== sub) throw notFound();

  return { status: 200, body: donationView(Item) };
});
