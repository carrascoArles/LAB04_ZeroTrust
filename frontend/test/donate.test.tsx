import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DONATION_ID,
  PROJECT_ID,
  aDonation,
  aProject,
  anonymous,
  fakeApi,
  json,
  renderApp,
  signedInAs,
} from "./helpers";

const SIMULATION_NOTICE = "Simulación académica: no se ha realizado ningún cobro";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const projectRoutes = {
  [`GET /v1/projects/${PROJECT_ID}`]: () => json(200, aProject()),
  [`GET /v1/projects/${PROJECT_ID}/stats`]: () =>
    json(200, {
      projectId: PROJECT_ID,
      goalAmountCents: 500_000,
      confirmedAmountCents: 125_000,
      currency: "PEN",
    }),
};

async function openDonationForm(api: ReturnType<typeof fakeApi>) {
  const rendered = renderApp({
    path: `/proyectos/${PROJECT_ID}`,
    auth: signedInAs("DONANTE"),
    api,
  });
  const amount = await screen.findByLabelText(/Monto en soles/);
  return { ...rendered, amount };
}

describe("donar y simular (HU-05, HU-06)", () => {
  it("envía 19.99 como 1999 céntimos con una Idempotency-Key UUID", async () => {
    const api = fakeApi({
      ...projectRoutes,
      "POST /v1/donations": () => json(201, aDonation()),
    });
    const { user, amount, requests } = await openDonationForm(api);

    await user.type(amount, "19.99");
    await user.click(screen.getByRole("button", { name: "Registrar intención de donación" }));

    expect(await screen.findByText("Intención de donación registrada")).toBeVisible();
    const post = requests.find((r) => r.method === "POST");
    expect(post?.body).toEqual({ projectId: PROJECT_ID, amountCents: 1999 });
    expect(post?.headers.get("Idempotency-Key")).toMatch(UUID);
    expect(post?.headers.get("Authorization")).toBe("Bearer access-token-DONANTE");
  });

  it("valida el monto antes de enviar y lo anuncia junto al campo", async () => {
    const api = fakeApi(projectRoutes);
    const { user, amount, requests } = await openDonationForm(api);

    await user.type(amount, "0.50");
    await user.click(screen.getByRole("button", { name: "Registrar intención de donación" }));

    expect(await screen.findByText("El monto mínimo es S/ 1.00.")).toBeVisible();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription(/El monto mínimo es S\/ 1.00./);
    expect(amount).toHaveFocus();
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });

  it("al reintentar el mismo envío reutiliza la clave; con otro monto usa una nueva (T06, T07)", async () => {
    let attempt = 0;
    const api = fakeApi({
      ...projectRoutes,
      "POST /v1/donations": () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError("Failed to fetch");
        if (attempt === 2) {
          return json(500, { code: "INTERNAL_ERROR", message: "x", requestId: "r-1" });
        }
        return json(201, aDonation({ amountCents: 2500 }));
      },
    });
    const { user, amount, requests } = await openDonationForm(api);

    await user.type(amount, "20");
    await user.click(screen.getByRole("button", { name: "Registrar intención de donación" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo conectar con el servidor.");

    await user.click(within(alert).getByRole("button", { name: "Reintentar el envío" }));
    expect(await screen.findByText("El servidor tuvo un problema.")).toBeVisible();

    await user.clear(amount);
    await user.type(amount, "25");
    await user.click(screen.getByRole("button", { name: "Registrar intención de donación" }));
    expect(await screen.findByText("Intención de donación registrada")).toBeVisible();

    const keys = requests
      .filter((r) => r.method === "POST")
      .map((r) => r.headers.get("Idempotency-Key"));
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("simula la confirmación y muestra el texto exacto de CA-06.4", async () => {
    const api = fakeApi({
      ...projectRoutes,
      "POST /v1/donations": () => json(201, aDonation()),
      [`POST /v1/donations/${DONATION_ID}/simulate`]: () =>
        json(200, aDonation({ status: "CONFIRMADA_SIMULADA" })),
    });
    const { user, amount, requests } = await openDonationForm(api);

    await user.type(amount, "19.99");
    await user.click(screen.getByRole("button", { name: "Registrar intención de donación" }));
    expect(await screen.findByText(SIMULATION_NOTICE)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Simular confirmación" }));

    expect(await screen.findByText("Resultado: Confirmada (simulada)")).toBeVisible();
    expect(screen.getByText(SIMULATION_NOTICE)).toBeVisible();
    const simulate = requests.find((r) => r.path.endsWith("/simulate"));
    expect(simulate?.body).toEqual({ outcome: "CONFIRMADA_SIMULADA" });
  });

  it("muestra el 409 de una transición repetida sin ocultarlo", async () => {
    const api = fakeApi({
      ...projectRoutes,
      "POST /v1/donations": () => json(201, aDonation()),
      [`POST /v1/donations/${DONATION_ID}/simulate`]: () =>
        json(409, {
          code: "INVALID_TRANSITION",
          message: "La donación ya no está pendiente de simulación.",
          requestId: "req-409",
        }),
    });
    const { user, amount } = await openDonationForm(api);

    await user.type(amount, "10");
    await user.click(screen.getByRole("button", { name: "Registrar intención de donación" }));
    await user.click(await screen.findByRole("button", { name: "Simular rechazo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La donación ya no está pendiente de simulación.",
    );
  });

  it("un visitante ve cómo iniciar sesión en lugar del formulario", async () => {
    renderApp({ path: `/proyectos/${PROJECT_ID}`, auth: anonymous(), api: fakeApi(projectRoutes) });
    expect(await screen.findByText("Inicia sesión para donar")).toBeVisible();
    expect(screen.queryByLabelText(/Monto en soles/)).toBeNull();
  });

  it("un GESTOR no ve el formulario de donación", async () => {
    renderApp({
      path: `/proyectos/${PROJECT_ID}`,
      auth: signedInAs("GESTOR"),
      api: fakeApi(projectRoutes),
    });
    expect(await screen.findByText("Tu cuenta no puede donar")).toBeVisible();
    expect(screen.queryByLabelText(/Monto en soles/)).toBeNull();
  });
});

describe("historial propio (HU-07)", () => {
  it("lista las donaciones del token con su proyecto y permite simular las pendientes", async () => {
    const api = fakeApi({
      "GET /v1/projects": () => json(200, { items: [aProject()] }),
      "GET /v1/donations/me": () =>
        json(200, {
          items: [
            aDonation(),
            aDonation({
              donationId: "16fd2706-8baf-433b-82eb-8c7fada847da",
              amountCents: 5000,
              status: "CONFIRMADA_SIMULADA",
            }),
          ],
        }),
    });
    renderApp({ path: "/mis-donaciones", auth: signedInAs("DONANTE"), api });

    const items = await screen.findAllByRole("article");
    expect(items).toHaveLength(2);
    expect(
      within(items[0]!).getByRole("link", { name: "Agua segura para Characato" }),
    ).toBeVisible();
    expect(within(items[0]!).getByText("S/ 19.99")).toBeVisible();
    expect(within(items[0]!).getByRole("button", { name: "Simular confirmación" })).toBeVisible();
    expect(within(items[1]!).getByText("Confirmada (simulada)")).toBeVisible();
    expect(within(items[1]!).queryByRole("button", { name: "Simular confirmación" })).toBeNull();
  });

  it("muestra un estado vacío con enlace al catálogo", async () => {
    const api = fakeApi({
      "GET /v1/projects": () => json(200, { items: [] }),
      "GET /v1/donations/me": () => json(200, { items: [] }),
    });
    renderApp({ path: "/mis-donaciones", auth: signedInAs("DONANTE"), api });
    expect(await screen.findByRole("link", { name: "Explora los proyectos" })).toBeVisible();
  });
});
