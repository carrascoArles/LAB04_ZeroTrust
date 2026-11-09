import { describe, expect, it } from "vitest";
import { handler as listAudit } from "../src/audit/list.js";
import { handler as createDonation } from "../src/donations/create.js";
import { handler as getDonation } from "../src/donations/get.js";
import { handler as myDonations } from "../src/donations/me.js";
import { handler as simulate } from "../src/donations/simulate.js";
import { handler as createProject } from "../src/projects/create.js";
import { handler as getProject } from "../src/projects/get.js";
import { handler as listProjects } from "../src/projects/list.js";
import { handler as publishProject } from "../src/projects/publish.js";
import { handler as getStats } from "../src/projects/stats.js";
import { apiEvent, auditor, bodyOf, donante, gestor } from "./helpers/events.js";
import { operations, useDatabase } from "./helpers/harness.js";
import { contract, functions, grantsOf, resources, template } from "./helpers/template.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const routeOf = (fn: any) => fn.Properties.Events.Route.Properties;
const PUBLIC_ROUTES = new Set([
  "GET /v1/projects",
  "GET /v1/projects/{projectId}",
  "GET /v1/projects/{projectId}/stats",
]);

describe("rutas y PEP (CA-NF02.1)", () => {
  const routes = Object.values(functions).map((fn) => `${routeOf(fn).Method} ${routeOf(fn).Path}`);

  it("la plantilla y el contrato OpenAPI definen las mismas rutas", () => {
    const documented = Object.entries(contract.paths).flatMap(([path, methods]) =>
      Object.keys(methods as object).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(new Set(routes)).toEqual(new Set(documented));
  });

  it("el authorizer valida emisor del user pool y el app client, y deniega por defecto", () => {
    const auth = resources.Api.Properties.Auth;
    expect(auth.DefaultAuthorizer).toBe("CognitoJwt");
    expect(auth.Authorizers.CognitoJwt.JwtConfiguration.audience).toEqual([
      { Ref: "UserPoolClient" },
    ]);
    expect(auth.Authorizers.CognitoJwt.JwtConfiguration.issuer.Sub).toContain("${UserPool}");
  });

  it("T02, T11: toda ruta no pública exige JWT y scope", () => {
    for (const fn of Object.values(functions)) {
      const route = routeOf(fn);
      const key = `${route.Method} ${route.Path}`;
      if (PUBLIC_ROUTES.has(key)) {
        expect(route.Auth, key).toEqual({ Authorizer: "NONE" });
      } else {
        expect(route.Auth.Authorizer, key).toBe("CognitoJwt");
        expect(route.Auth.AuthorizationScopes?.length, key).toBeGreaterThan(0);
      }
    }
  });

  it("los scopes de la plantilla coinciden con los del contrato", () => {
    for (const fn of Object.values(functions)) {
      const route = routeOf(fn);
      if (route.Auth.Authorizer === "NONE") continue;
      const operation = contract.paths[route.Path][route.Method.toLowerCase()];
      expect(operation.security[0].cognitoJwt).toEqual(route.Auth.AuthorizationScopes);
    }
  });

  it("CA-06.1: la simulación solo existe en el stage académico", () => {
    expect(functions.SimulateDonationFunction.Condition).toBe("IsAcademic");
    expect(template.Conditions.IsAcademic.Equals).toEqual([{ Ref: "StageName" }, "academic"]);
  });
});

describe("Cognito", () => {
  const client = resources.UserPoolClient.Properties;
  const pool = resources.UserPool.Properties;

  it("CA-03.1: solo Authorization Code, sin secreto ni flujo implícito", () => {
    expect(client.AllowedOAuthFlows).toEqual(["code"]);
    expect(client.GenerateSecret).toBe(false);
  });

  it("CA-03.3: access token de 15 minutos o menos y revocación activa", () => {
    expect(client.TokenValidityUnits.AccessToken).toBe("minutes");
    expect(client.AccessTokenValidity).toBeLessThanOrEqual(15);
    expect(client.EnableTokenRevocation).toBe(true);
  });

  it("CA-11.1: MFA solo por TOTP, sin SMS", () => {
    expect(pool.EnabledMfas).toEqual(["SOFTWARE_TOKEN_MFA"]);
  });

  it("CA-NF10.1: sin autorregistro", () => {
    expect(pool.AdminCreateUserConfig.AllowAdminCreateUserOnly).toBe(true);
  });

  it("AD-09: el client de aprovisionamiento no usa OAuth ni sirve para el API", () => {
    const provisioning = resources.ProvisioningClient.Properties;
    expect(provisioning.AllowedOAuthFlows).toBeUndefined();
    expect(provisioning.AllowedOAuthScopes).toBeUndefined();
    expect(provisioning.AccessTokenValidity).toBeLessThanOrEqual(15);
    const { audience } = resources.Api.Properties.Auth.Authorizers.CognitoJwt.JwtConfiguration;
    expect(audience).not.toContainEqual({ Ref: "ProvisioningClient" });
  });

  it("localhost solo se admite en el stage académico", () => {
    const { If: callback } = client.CallbackURLs;
    expect(callback[0]).toBe("IsAcademic");
    expect(callback[1]).toContain("http://localhost:5173/callback");
    expect(callback[2]).not.toContain("http://localhost:5173/callback");
  });
});

describe("mínimo privilegio (CA-NF03.1, CA-NF03.2)", () => {
  it("cada función declara su propia política; ninguna comparte rol", () => {
    for (const [name, fn] of Object.entries(functions)) {
      expect(fn.Properties.Role, name).toBeUndefined();
      expect(fn.Properties.Policies?.length, name).toBeGreaterThan(0);
    }
  });

  it("ninguna política usa comodines", () => {
    for (const name of Object.keys(functions)) {
      for (const { action, resource } of grantsOf(name)) {
        expect(action, name).not.toContain("*");
        expect(resource, name).not.toContain("*");
      }
    }
  });

  it("T10: la función de listado no tiene ningún permiso de escritura", () => {
    expect(grantsOf("ListProjectsFunction")).toEqual([
      { action: "dynamodb:Query", resource: "ProjectsTable/index/status-createdAt" },
    ]);
  });

  it("las funciones públicas de lectura no alcanzan otras tablas", () => {
    for (const name of ["GetProjectFunction", "GetProjectStatsFunction"]) {
      expect(grantsOf(name)).toEqual([{ action: "dynamodb:GetItem", resource: "ProjectsTable" }]);
    }
  });

  it("solo las funciones que transaccionan donaciones escriben en Donations", () => {
    const writers = Object.keys(functions).filter((name) =>
      grantsOf(name).some(
        (g) => g.resource === "DonationsTable" && /Put|Update|Delete/.test(g.action),
      ),
    );
    expect(writers.sort()).toEqual(["CreateDonationFunction", "SimulateDonationFunction"]);
  });
});

describe("observabilidad (CA-NF07.1)", () => {
  const logGroups = Object.values(resources).filter((r: any) => r.Type === "AWS::Logs::LogGroup");

  it("cada función y el API tienen log group con retención de 14 días", () => {
    expect(logGroups).toHaveLength(Object.keys(functions).length + 1);
    for (const group of logGroups as any[]) expect(group.Properties.RetentionInDays).toBe(14);
  });

  it("los logs de Lambda son JSON", () => {
    expect(template.Globals.Function.LoggingConfig.LogFormat).toBe("JSON");
  });

  it("no se definen servicios fuera de alcance", () => {
    const types = Object.values(resources).map((r: any) => String(r.Type));
    expect(types.some((t) => /GuardDuty|SecurityHub|WAF/i.test(t))).toBe(false);
  });
});

describe("cada handler opera dentro de los permisos de su rol", () => {
  useDatabase();

  /** Ejecuta el handler y exige que cada operación esté permitida por el rol de su función. */
  async function within<T>(functionName: string, call: () => Promise<T>): Promise<T> {
    operations.length = 0;
    const result = await call();
    const grants = grantsOf(functionName);
    expect(operations.length, `${functionName} no hizo ninguna operación`).toBeGreaterThan(0);
    for (const operation of operations) {
      expect(grants, `${functionName}: ${JSON.stringify(operation)}`).toContainEqual(operation);
    }
    return result;
  }

  it("flujo completo", async () => {
    const created = await within("CreateProjectFunction", () =>
      createProject(
        apiEvent({
          claims: gestor,
          body: { title: "Huerto", description: "Escolar", goalAmountCents: 1_000 },
        }),
      ),
    );
    const { projectId } = bodyOf(created);
    const pathParameters = { projectId };

    await within("PublishProjectFunction", () =>
      publishProject(apiEvent({ claims: gestor, pathParameters })),
    );
    await within("ListProjectsFunction", () => listProjects(apiEvent()));
    await within("GetProjectFunction", () => getProject(apiEvent({ pathParameters })));
    await within("GetProjectStatsFunction", () => getStats(apiEvent({ pathParameters })));

    const key = "11111111-1111-4111-8111-111111111111";
    const body = { projectId, amountCents: 1_000 };
    const headers = { "idempotency-key": key };
    const donation = await within("CreateDonationFunction", () =>
      createDonation(apiEvent({ claims: donante, headers, body })),
    );
    // El reintento recorre además la lectura de la clave y de la donación.
    await within("CreateDonationFunction", () =>
      createDonation(apiEvent({ claims: donante, headers, body })),
    );
    const { donationId } = bodyOf(donation);

    await within("GetMyDonationsFunction", () => myDonations(apiEvent({ claims: donante })));
    await within("GetDonationFunction", () =>
      getDonation(apiEvent({ claims: donante, pathParameters: { donationId } })),
    );
    await within("SimulateDonationFunction", () =>
      simulate(
        apiEvent({
          claims: donante,
          pathParameters: { donationId },
          body: { outcome: "CONFIRMADA_SIMULADA" },
        }),
      ),
    );
    await within("GetAuditFunction", () =>
      listAudit(apiEvent({ claims: auditor, query: { eventType: "DONATION_CREATED" } })),
    );
  });

  it("cada función recibe por entorno las tablas que usa", () => {
    const expected: Record<string, string[]> = {
      ListProjectsFunction: ["PROJECTS_TABLE"],
      GetProjectFunction: ["PROJECTS_TABLE"],
      GetProjectStatsFunction: ["PROJECTS_TABLE"],
      CreateProjectFunction: ["PROJECTS_TABLE", "AUDIT_TABLE"],
      PublishProjectFunction: ["PROJECTS_TABLE", "AUDIT_TABLE"],
      CreateDonationFunction: [
        "PROJECTS_TABLE",
        "DONATIONS_TABLE",
        "IDEMPOTENCY_TABLE",
        "AUDIT_TABLE",
      ],
      SimulateDonationFunction: ["PROJECTS_TABLE", "DONATIONS_TABLE", "AUDIT_TABLE"],
      GetMyDonationsFunction: ["DONATIONS_TABLE"],
      GetDonationFunction: ["DONATIONS_TABLE"],
      GetAuditFunction: ["AUDIT_TABLE"],
    };
    expect(Object.keys(expected).sort()).toEqual(Object.keys(functions).sort());
    for (const [name, variables] of Object.entries(expected)) {
      const environment = functions[name].Properties.Environment.Variables;
      expect(Object.keys(environment).sort(), name).toEqual([...variables].sort());
    }
  });
});
