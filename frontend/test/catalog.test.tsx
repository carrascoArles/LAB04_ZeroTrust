import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PROJECT_ID, aProject, fakeApi, json, renderApp } from "./helpers";

describe("catálogo y detalle (HU-01, HU-02, HU-09)", () => {
  it("muestra los proyectos con su avance accesible", async () => {
    renderApp({ api: fakeApi({ "GET /v1/projects": () => json(200, { items: [aProject()] }) }) });

    expect(await screen.findByRole("link", { name: "Agua segura para Characato" })).toBeVisible();
    const progress = screen.getByRole("progressbar", {
      name: "S/ 1,250.00 confirmados de S/ 5,000.00 (25 %)",
    });
    expect(progress).toHaveAttribute("value", "25");
    expect(screen.getByRole("status")).toHaveTextContent("1 proyecto publicado");
  });

  it("filtra por título sin distinguir tildes", async () => {
    const items = [
      aProject(),
      aProject({ projectId: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", title: "Biblioteca rural" }),
    ];
    const { user } = renderApp({
      api: fakeApi({ "GET /v1/projects": () => json(200, { items }) }),
    });

    await user.type(await screen.findByLabelText("Buscar proyecto por título"), "BIBLIOTÉCA");

    expect(await screen.findByText("1 de 2 proyectos coincide con la búsqueda")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Agua segura para Characato" })).toBeNull();
  });

  it("muestra un estado vacío comprensible", async () => {
    renderApp({ api: fakeApi({ "GET /v1/projects": () => json(200, { items: [] }) }) });
    expect(await screen.findByText(/Todavía no hay proyectos publicados/)).toBeVisible();
  });

  it("explica una falla del API y permite reintentar", async () => {
    let calls = 0;
    const { user } = renderApp({
      api: fakeApi({
        "GET /v1/projects": () =>
          ++calls === 1
            ? json(500, { code: "INTERNAL_ERROR", message: "x", requestId: "req-500" })
            : json(200, { items: [aProject()] }),
      }),
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El servidor tuvo un problema.");
    expect(alert).toHaveTextContent("req-500");

    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("link", { name: "Agua segura para Characato" })).toBeVisible();
  });

  it("el detalle usa las cifras agregadas de /stats", async () => {
    renderApp({
      path: `/proyectos/${PROJECT_ID}`,
      api: fakeApi({
        [`GET /v1/projects/${PROJECT_ID}`]: () => json(200, aProject()),
        [`GET /v1/projects/${PROJECT_ID}/stats`]: () =>
          json(200, {
            projectId: PROJECT_ID,
            goalAmountCents: 500_000,
            confirmedAmountCents: 250_000,
            currency: "PEN",
          }),
      }),
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Agua segura para Characato" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("progressbar", {
        name: "S/ 2,500.00 confirmados de S/ 5,000.00 (50 %)",
      }),
    ).toBeVisible();
    expect(document.title).toBe("Agua segura para Characato · AQP-SOLIDARIA");
  });

  it("el detalle muestra identificador, objetivo, estado y monto acumulado (CA-02.1)", async () => {
    renderApp({
      path: `/proyectos/${PROJECT_ID}`,
      api: fakeApi({ [`GET /v1/projects/${PROJECT_ID}`]: () => json(200, aProject()) }),
    });

    const details = await screen.findByRole("group", { name: "Datos del proyecto" });
    expect(within(details).getByText(PROJECT_ID)).toBeVisible();
    expect(within(details).getByText("Publicado")).toBeVisible();
    expect(within(details).getByText("S/ 5,000.00")).toBeVisible();
    expect(within(details).getByText("S/ 1,250.00")).toBeVisible();
  });

  it("un proyecto inexistente o no publicado se informa como no encontrado", async () => {
    renderApp({ path: `/proyectos/${PROJECT_ID}` });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Proyecto no encontrado" }),
    ).toBeVisible();
  });
});
