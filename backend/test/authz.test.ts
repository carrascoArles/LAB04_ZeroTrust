import { describe, expect, it } from "vitest";
import { authorize, parseGroups, pseudonym } from "../src/authz/index.js";
import { accessToken, apiEvent } from "./helpers/events.js";
import type { ApiError } from "../src/shared/errors.js";

const policy = { group: "DONANTE", scope: "api/donations.write" } as const;

function statusFrom(action: () => unknown): number | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return (error as ApiError).status;
  }
}

describe("authz: identidad solo desde claims verificados", () => {
  it("T02: sin claims del authorizer responde 401", () => {
    expect(statusFrom(() => authorize(apiEvent(), policy))).toBe(401);
  });

  it("T11: un ID token responde 401 aunque traiga el grupo correcto", () => {
    const claims = accessToken("sub-a", "DONANTE", { token_use: "id" });
    expect(statusFrom(() => authorize(apiEvent({ claims }), policy))).toBe(401);
  });

  it("sin sub responde 401", () => {
    const claims = accessToken("", "DONANTE");
    expect(statusFrom(() => authorize(apiEvent({ claims }), policy))).toBe(401);
  });

  it("sin el scope de la ruta responde 403", () => {
    const claims = accessToken("sub-a", "DONANTE", { scope: "openid email" });
    expect(statusFrom(() => authorize(apiEvent({ claims }), policy))).toBe(403);
  });

  it("CA-04.1: sin el grupo requerido responde 403", () => {
    const claims = accessToken("sub-a", "GESTOR");
    expect(statusFrom(() => authorize(apiEvent({ claims }), policy))).toBe(403);
  });

  it("sin ningún grupo responde 403", () => {
    const claims = accessToken("sub-a");
    expect(statusFrom(() => authorize(apiEvent({ claims }), policy))).toBe(403);
  });

  it("CA-04.3: el cuerpo y las cabeceras no pueden aportar identidad ni rol", () => {
    const event = apiEvent({
      claims: accessToken("sub-real", "DONANTE"),
      body: { sub: "sub-falso", "cognito:groups": "[GESTOR]" },
      headers: { "x-sub": "sub-falso", "cognito:groups": "GESTOR" },
    });
    expect(authorize(event, policy).sub).toBe("sub-real");
    expect(
      statusFrom(() => authorize(event, { group: "GESTOR", scope: "api/donations.write" })),
    ).toBe(403);
  });

  it("devuelve la identidad cuando todo es válido", () => {
    const identity = authorize(apiEvent({ claims: accessToken("sub-a", "DONANTE") }), policy);
    expect(identity).toEqual({ sub: "sub-a", groups: ["DONANTE"] });
  });
});

describe("parseGroups: formatos del claim cognito:groups", () => {
  it.each([
    ["[DONANTE]", ["DONANTE"]],
    ["[DONANTE GESTOR]", ["DONANTE", "GESTOR"]],
    ['["DONANTE","GESTOR"]', ["DONANTE", "GESTOR"]],
    ["DONANTE", ["DONANTE"]],
    [
      ["DONANTE", "AUDITOR"],
      ["DONANTE", "AUDITOR"],
    ],
    [undefined, []],
    ["", []],
    [42, []],
  ])("%j", (claim, expected) => {
    expect(parseGroups(claim)).toEqual(expected);
  });

  it("no confunde un grupo con otro que lo contiene", () => {
    expect(parseGroups("[NO_GESTOR]")).not.toContain("GESTOR");
  });
});

describe("pseudonym", () => {
  it("es estable, distingue usuarios y no contiene el sub", () => {
    expect(pseudonym("sub-a")).toBe(pseudonym("sub-a"));
    expect(pseudonym("sub-a")).not.toBe(pseudonym("sub-b"));
    expect(pseudonym("sub-a")).not.toContain("sub-a");
    expect(pseudonym("sub-a")).toMatch(/^usr_[0-9a-f]{16}$/);
  });
});
