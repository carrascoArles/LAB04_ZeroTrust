import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config/env";

const ENV = {
  VITE_API_URL: "https://abc123.execute-api.us-east-2.amazonaws.com/academic/",
  VITE_COGNITO_DOMAIN: "https://aqp-solidaria-academic-0000.auth.us-east-2.amazoncognito.com",
  VITE_USER_POOL_ID: "us-east-2_AbCdEf123",
  VITE_CLIENT_ID: "client123",
};

describe("loadConfig", () => {
  it("deriva la URI de retorno y la de logout del origen si no hay VITE_REDIRECT_URI", () => {
    const config = loadConfig(ENV, "https://dttr462utsd2h.cloudfront.net");
    expect(config.redirectUri).toBe("https://dttr462utsd2h.cloudfront.net/callback");
    expect(config.logoutUri).toBe("https://dttr462utsd2h.cloudfront.net/");
    expect(config.apiUrl).toBe("https://abc123.execute-api.us-east-2.amazonaws.com/academic");
    expect(config.region).toBe("us-east-2");
  });

  it("respeta VITE_REDIRECT_URI cuando se define", () => {
    const config = loadConfig(
      { ...ENV, VITE_REDIRECT_URI: "http://localhost:5173/callback" },
      "https://otro.example",
    );
    expect(config.redirectUri).toBe("http://localhost:5173/callback");
    expect(config.logoutUri).toBe("http://localhost:5173/");
  });

  it("exige HTTPS para el API y Cognito (CA-NF01.1)", () => {
    expect(() =>
      loadConfig({ ...ENV, VITE_API_URL: "http://abc.example/academic" }, "http://localhost"),
    ).toThrow(ConfigError);
  });

  it("indica qué variables faltan", () => {
    try {
      loadConfig({ VITE_API_URL: ENV.VITE_API_URL }, "http://localhost:5173");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).missing).toEqual([
        "VITE_COGNITO_DOMAIN",
        "VITE_USER_POOL_ID",
        "VITE_CLIENT_ID",
      ]);
    }
  });
});
