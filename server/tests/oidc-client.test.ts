import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";

const oidc = vi.hoisted(() => ({
  authorizationCodeGrant: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  discovery: vi.fn(),
  randomNonce: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  randomState: vi.fn(),
}));
vi.mock("openid-client", () => oidc);

import { createOidcClient } from "../src/services/oidc-client.js";

const baseEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
  OIDC_ISSUER_URL: "https://identity.example.test",
  OIDC_CLIENT_ID: "kommunity",
  OIDC_CLIENT_SECRET: "secret",
  OIDC_REDIRECT_URI: "http://127.0.0.1:8787/api/v1/auth/oidc/callback",
};
const config = loadConfig(baseEnvironment as NodeJS.ProcessEnv);

beforeEach(() => {
  vi.clearAllMocks();
  oidc.discovery.mockResolvedValue({ serverMetadata: true });
  oidc.randomPKCECodeVerifier.mockReturnValue("verifier");
  oidc.calculatePKCECodeChallenge.mockResolvedValue("challenge");
  oidc.randomNonce.mockReturnValue("nonce");
  oidc.randomState.mockReturnValue("state");
  oidc.buildAuthorizationUrl.mockReturnValue(
    new URL("https://identity.example.test/authorize"),
  );
});

describe("OIDC provider adapter", () => {
  it("builds Authorization Code with PKCE and caches discovery", async () => {
    const client = createOidcClient(config);
    await expect(client.authorizationRequest()).resolves.toEqual({
      codeVerifier: "verifier",
      nonce: "nonce",
      state: "state",
      url: new URL("https://identity.example.test/authorize"),
    });
    await client.authorizationRequest();

    expect(oidc.discovery).toHaveBeenCalledOnce();
    expect(oidc.discovery).toHaveBeenCalledWith(
      new URL("https://identity.example.test"),
      "kommunity",
      "secret",
    );
    expect(oidc.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        code_challenge: "challenge",
        code_challenge_method: "S256",
        nonce: "nonce",
        redirect_uri: baseEnvironment.OIDC_REDIRECT_URI,
        response_type: "code",
        scope: "openid profile email",
        state: "state",
      }),
    );
  });

  it("normalizes complete verified provider claims", async () => {
    oidc.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        email: "LEE@EXAMPLE.TEST",
        email_verified: true,
        iss: "https://identity.example.test",
        name: "Lee Morgan",
        preferred_username: "lee_m",
        sub: "subject_1",
      }),
    });
    const client = createOidcClient(config);

    await expect(
      client.consumeCallback({
        codeVerifier: "verifier",
        currentUrl: new URL("http://localhost/callback?code=one"),
        expectedNonce: "nonce",
        expectedState: "state",
      }),
    ).resolves.toEqual({
      displayName: "Lee Morgan",
      email: "lee@example.test",
      emailVerified: true,
      issuer: "https://identity.example.test",
      preferredUsername: "lee_m",
      subject: "subject_1",
    });
    expect(oidc.authorizationCodeGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(URL),
      {
        expectedNonce: "nonce",
        expectedState: "state",
        pkceCodeVerifier: "verifier",
      },
    );
  });

  it("omits non-string preferred usernames", async () => {
    oidc.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        email: "lee@example.test",
        email_verified: false,
        iss: "https://identity.example.test",
        name: "Lee Morgan",
        preferred_username: 42,
        sub: "subject_1",
      }),
    });
    await expect(
      createOidcClient(config).consumeCallback({
        codeVerifier: "verifier",
        currentUrl: new URL("http://localhost/callback?code=one"),
        expectedNonce: "nonce",
        expectedState: "state",
      }),
    ).resolves.toMatchObject({
      emailVerified: false,
      preferredUsername: undefined,
    });
  });

  it.each([
    undefined,
    {},
    { iss: 1, sub: "subject", email: "lee@example.test", name: "Lee" },
    { iss: "issuer", sub: 1, email: "lee@example.test", name: "Lee" },
    { iss: "issuer", sub: "subject", email: 1, name: "Lee" },
    { iss: "issuer", sub: "subject", email: "lee@example.test", name: 1 },
  ])("rejects incomplete provider claims %#", async (claims) => {
    oidc.authorizationCodeGrant.mockResolvedValue({ claims: () => claims });
    await expect(
      createOidcClient(config).consumeCallback({
        codeVerifier: "verifier",
        currentUrl: new URL("http://localhost/callback?code=one"),
        expectedNonce: "nonce",
        expectedState: "state",
      }),
    ).rejects.toMatchObject({
      code: "OIDC_CLAIMS_INVALID",
      statusCode: 401,
    });
  });

  it("fails explicitly when OIDC is unavailable", async () => {
    const client = createOidcClient(
      loadConfig({
        DATABASE_URL: baseEnvironment.DATABASE_URL,
      } as NodeJS.ProcessEnv),
    );
    await expect(client.authorizationRequest()).rejects.toMatchObject({
      code: "OIDC_NOT_CONFIGURED",
      statusCode: 503,
    });
    await expect(
      client.consumeCallback({
        codeVerifier: "verifier",
        currentUrl: new URL("http://localhost/callback"),
        expectedNonce: "nonce",
        expectedState: "state",
      }),
    ).rejects.toMatchObject({ code: "OIDC_NOT_CONFIGURED" });
  });
});
