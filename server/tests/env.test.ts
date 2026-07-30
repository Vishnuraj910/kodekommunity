import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

const base = {
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
};

describe("environment configuration", () => {
  it("applies safe local defaults and parses explicit booleans", () => {
    expect(loadConfig(base as NodeJS.ProcessEnv)).toEqual(
      expect.objectContaining({
        ALLOW_DEMO_AUTH: false,
        API_PUBLIC_URL: "http://127.0.0.1:8787",
        CLIENT_ORIGIN: "http://127.0.0.1:4173",
        EMAIL_VERIFICATION_MODE: "auto",
        EMAIL_VERIFICATION_TTL_HOURS: 24,
        HOST: "127.0.0.1",
        NODE_ENV: "development",
        OIDC_SCOPES: "openid profile email",
        PORT: 8787,
        SESSION_COOKIE_NAME: "kommunity_session",
        SESSION_TTL_HOURS: 12,
      }),
    );
    expect(
      loadConfig({
        ...base,
        ALLOW_DEMO_AUTH: "TRUE",
        PORT: "9000",
      } as NodeJS.ProcessEnv),
    ).toEqual(expect.objectContaining({ ALLOW_DEMO_AUTH: true, PORT: 9000 }));
  });

  it.each([
    [
      "production demo authentication",
      { ...base, NODE_ENV: "production", ALLOW_DEMO_AUTH: "true", DEMO_USER_ID: "maya" },
      /cannot be enabled in production/,
    ],
    [
      "partial OIDC",
      { ...base, OIDC_CLIENT_ID: "client-only" },
      /must be configured together/,
    ],
    [
      "production verification bypass",
      {
        ...base,
        NODE_ENV: "production",
        API_PUBLIC_URL: "https://api.example.test",
        CLIENT_ORIGIN: "https://app.example.test",
      },
      /cannot be skipped in production/,
    ],
    [
      "email verification without a provider",
      { ...base, EMAIL_VERIFICATION_MODE: "email" },
      /RESEND_API_KEY and EMAIL_FROM are required/,
    ],
    [
      "non-PostgreSQL storage",
      { ...base, DATABASE_URL: "https://example.test/database" },
      /must use PostgreSQL/,
    ],
    [
      "invalid boolean",
      { ...base, ALLOW_DEMO_AUTH: "sometimes" },
      /expected boolean/i,
    ],
  ])("rejects %s", (_name, environment, expected) => {
    expect(() => loadConfig(environment as NodeJS.ProcessEnv)).toThrow(expected);
  });

  it("accepts a complete OIDC confidential-client configuration", () => {
    expect(
      loadConfig({
        ...base,
        OIDC_ISSUER_URL: "https://identity.example.test",
        OIDC_CLIENT_ID: "kommunity",
        OIDC_CLIENT_SECRET: "secret",
        OIDC_REDIRECT_URI: "http://127.0.0.1:8787/api/v1/auth/oidc/callback",
      } as NodeJS.ProcessEnv),
    ).toEqual(
      expect.objectContaining({
        OIDC_CLIENT_ID: "kommunity",
        OIDC_ISSUER_URL: "https://identity.example.test",
      }),
    );
  });
});
