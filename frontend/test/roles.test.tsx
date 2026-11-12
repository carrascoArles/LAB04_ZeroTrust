import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PROJECT_ID, aProject, anonymous, fakeApi, json, renderApp, signedInAs } from "./helpers";

const catalog = { "GET /v1/projects": () => json(200, { items: [] }) };

describe("layout y accesibilidad (CA-NF06, CA-NF10.2)", () => {
  it("muestra el aviso de prototipo académico y la nota legal", async () => {
    renderApp({ api: fakeApi(catalog) });
    expect(await screen.findByText(/Prototipo académico:/)).toBeVisible();
    expect(screen.getByText(/Ley N\.º 29733/)).toBeVisible();
  });

  it("ofrece un enlace para saltar al contenido y un único h1", async () => {
    renderApp({ api: fakeApi(catalog) });
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute(
      "href",
      "#contenido",
    );
    expect(await screen.findAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("al navegar mueve el foco al contenido principal", async () => {
    const { user } = renderApp({
      api: fakeApi({ "GET /v1/projects": () => json(200, { items: [aProject()] }) }),
    });
    await user.click(await screen.findByRole("link", { name: "Agua segura para Characato" }));
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("navegación por rol (solo experiencia; el API decide)", () => {
  it.each([
    ["DONANTE", "Mis donaciones"],
    ["GESTOR", "Gestión"],
    ["AUDITOR", "Auditoría"],
  ] as const)("%s ve el enlace %s", async (role, label) => {
    renderApp({ auth: signedInAs(role), api: fakeApi(catalog) });
    const nav = await screen.findByRole("navigation", { name: "Principal" });
    const links = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(links).toEqual(["Proyectos", label]);
  });

  it("muestra la sesión y permite cerrarla", async () => {
    const auth = signedInAs("DONANTE");
    const { user } = renderApp({ auth, api: fakeApi(catalog) });
    expect(screen.getByText("donante@aqp-solidaria.test")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("un visitante en /gestion ve cómo iniciar sesión y vuelve ahí después", async () => {
    const auth = anonymous();
    const { user } = renderApp({ path: "/gestion", auth });
    expect(await screen.findByText("Necesitas iniciar sesión")).toBeVisible();
    const main = screen.getByRole("main");
    await user.click(within(main).getByRole("button", { name: "Iniciar sesión" }));
    expect(auth.signIn).toHaveBeenCalledWith("/gestion");
  });

  it("un DONANTE en /auditoria recibe una explicación, no la pantalla", async () => {
    renderApp({ path: "/auditoria", auth: signedInAs("DONANTE") });
    expect(await screen.findByText("Tu cuenta no tiene acceso a esta sección")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Consultar eventos" })).toBeNull();
  });

  it("avisa cuando la sesión expiró", async () => {
    renderApp({ auth: anonymous({ sessionExpired: true }), api: fakeApi(catalog) });
    expect(await screen.findByText("Tu sesión expiró")).toBeVisible();
  });
});

describe("gestión de proyectos (HU-08)", () => {
  it("crea un borrador en céntimos y lo publica", async () => {
    const draft = aProject({
      title: "Comedor popular",
      goalAmountCents: 500_050,
      confirmedAmountCents: 0,
      status: "BORRADOR",
    });
    const api = fakeApi({
      "POST /v1/projects": () => json(201, draft),
      [`PATCH /v1/projects/${PROJECT_ID}/publish`]: () =>
        json(200, { ...draft, status: "PUBLICADO" }),
    });
    const { user, requests } = renderApp({ path: "/gestion", auth: signedInAs("GESTOR"), api });

    await user.type(await screen.findByLabelText(/^Título/), "  Comedor popular ");
    await user.type(screen.getByLabelText(/^Descripción/), "Almuerzos para 60 niños.");
    await user.type(screen.getByLabelText(/^Meta en soles/), "5000.50");
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));

    expect(await screen.findByText("Borrador creado")).toBeVisible();
    expect(requests.find((r) => r.method === "POST")?.body).toEqual({
      title: "Comedor popular",
      description: "Almuerzos para 60 niños.",
      goalAmountCents: 500_050,
    });

    await user.click(screen.getByRole("button", { name: "Publicar «Comedor popular»" }));
    expect(await screen.findByRole("link", { name: "Ver en el catálogo" })).toBeVisible();
    expect(requests.some((r) => r.method === "PATCH")).toBe(true);
  });

  it("muestra el 409 al publicar un proyecto ya publicado", async () => {
    const api = fakeApi({
      [`PATCH /v1/projects/${PROJECT_ID}/publish`]: () =>
        json(409, {
          code: "ALREADY_PUBLISHED",
          message: "El proyecto ya está publicado.",
          requestId: "req-1",
        }),
    });
    const { user } = renderApp({ path: "/gestion", auth: signedInAs("GESTOR"), api });

    await user.type(await screen.findByLabelText(/^Identificador del proyecto/), PROJECT_ID);
    await user.click(screen.getByRole("button", { name: "Publicar por identificador" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El proyecto ya está publicado.");
  });
});

describe("auditoría (HU-10)", () => {
  it("consulta por tipo y muestra los eventos en una tabla desplazable con teclado", async () => {
    const api = fakeApi({
      "GET /v1/audit": () =>
        json(200, {
          items: [
            {
              eventId: "e1",
              timestamp: "2026-11-11T15:30:00.000Z",
              requestId: "req-a",
              actorRef: "usr_0123456789abcdef",
              action: "CreateDonation",
              resourceRef: "donation:abc",
              outcome: "SUCCESS",
            },
          ],
        }),
    });
    const { user, requests } = renderApp({ path: "/auditoria", auth: signedInAs("AUDITOR"), api });

    await user.selectOptions(await screen.findByLabelText(/^Tipo de evento/), "PROJECT_PUBLISHED");
    await user.click(screen.getByRole("button", { name: "Consultar eventos" }));

    const region = await screen.findByRole("region", { name: "Eventos de auditoría" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("cell", { name: "usr_0123456789abcdef" })).toBeVisible();
    expect(requests[0]?.query.get("eventType")).toBe("PROJECT_PUBLISHED");
  });
});
