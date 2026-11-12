import type { ApiClient } from "./http";
import {
  donationListSchema,
  donationSchema,
  type CreateDonationRequest,
  type Donation,
  type SimulationOutcome,
} from "./schemas";

const donationPath = (donationId: string) => `/v1/donations/${encodeURIComponent(donationId)}`;

/**
 * createDonation: POST /v1/donations (DONANTE, HU-05). El cuerpo lleva solo projectId y
 * amountCents: el donante sale del token, nunca del cuerpo (CA-05.3).
 */
export function createDonation(
  api: ApiClient,
  accessToken: string,
  input: CreateDonationRequest,
  idempotencyKey: string,
) {
  return api.request<Donation>({
    operation: "createDonation",
    method: "POST",
    path: "/v1/donations",
    schema: donationSchema,
    accessToken,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { projectId: input.projectId, amountCents: input.amountCents },
  });
}

/** getMyDonations: GET /v1/donations/me (DONANTE, HU-07). */
export async function getMyDonations(
  api: ApiClient,
  accessToken: string,
  signal?: AbortSignal,
): Promise<Donation[]> {
  const { items } = await api.request({
    operation: "getMyDonations",
    method: "GET",
    path: "/v1/donations/me",
    schema: donationListSchema,
    accessToken,
    signal,
  });
  return items;
}

/** getDonation: GET /v1/donations/{donationId} (DONANTE propietario; ajena = 404, T09). */
export function getDonation(
  api: ApiClient,
  accessToken: string,
  donationId: string,
  signal?: AbortSignal,
) {
  return api.request<Donation>({
    operation: "getDonation",
    method: "GET",
    path: donationPath(donationId),
    schema: donationSchema,
    accessToken,
    signal,
  });
}

/** simulateDonation: POST /v1/donations/{donationId}/simulate (DONANTE propietario, HU-06). */
export function simulateDonation(
  api: ApiClient,
  accessToken: string,
  donationId: string,
  outcome: SimulationOutcome,
) {
  return api.request<Donation>({
    operation: "simulateDonation",
    method: "POST",
    path: `${donationPath(donationId)}/simulate`,
    schema: donationSchema,
    accessToken,
    body: { outcome },
  });
}
