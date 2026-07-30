import * as client from "openid-client";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../domain/errors.js";

export type OidcProfile = {
  displayName: string;
  email: string;
  emailVerified: boolean;
  issuer: string;
  preferredUsername?: string;
  subject: string;
};

export interface OidcClient {
  authorizationRequest(): Promise<{
    codeVerifier: string;
    nonce: string;
    state: string;
    url: URL;
  }>;
  consumeCallback(input: {
    codeVerifier: string;
    currentUrl: URL;
    expectedNonce: string;
    expectedState: string;
  }): Promise<OidcProfile>;
}

const requiredOidcConfig = (config: AppConfig) => {
  if (
    !config.OIDC_ISSUER_URL ||
    !config.OIDC_CLIENT_ID ||
    !config.OIDC_CLIENT_SECRET ||
    !config.OIDC_REDIRECT_URI
  ) {
    throw new AppError(
      503,
      "OIDC_NOT_CONFIGURED",
      "OIDC is not configured for this environment",
    );
  }
  return {
    clientId: config.OIDC_CLIENT_ID,
    clientSecret: config.OIDC_CLIENT_SECRET,
    issuer: config.OIDC_ISSUER_URL,
    redirectUri: config.OIDC_REDIRECT_URI,
  };
};

export const createOidcClient = (config: AppConfig): OidcClient => {
  let configuration: Promise<client.Configuration> | undefined;
  const getConfiguration = () => {
    const oidc = requiredOidcConfig(config);
    configuration ??= client.discovery(
      new URL(oidc.issuer),
      oidc.clientId,
      oidc.clientSecret,
    );
    return configuration;
  };

  return {
    async authorizationRequest() {
      const oidc = requiredOidcConfig(config);
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge =
        await client.calculatePKCECodeChallenge(codeVerifier);
      const nonce = client.randomNonce();
      const state = client.randomState();
      const url = client.buildAuthorizationUrl(await getConfiguration(), {
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        nonce,
        redirect_uri: oidc.redirectUri,
        response_type: "code",
        scope: config.OIDC_SCOPES,
        state,
      });
      return { codeVerifier, nonce, state, url };
    },
    async consumeCallback({
      codeVerifier,
      currentUrl,
      expectedNonce,
      expectedState,
    }) {
      const tokens = await client.authorizationCodeGrant(
        await getConfiguration(),
        currentUrl,
        {
          expectedNonce,
          expectedState,
          pkceCodeVerifier: codeVerifier,
        },
      );
      const claims = tokens.claims();
      if (
        !claims ||
        typeof claims.iss !== "string" ||
        typeof claims.sub !== "string" ||
        typeof claims.email !== "string" ||
        typeof claims.name !== "string"
      ) {
        throw new AppError(
          401,
          "OIDC_CLAIMS_INVALID",
          "The identity provider returned incomplete claims",
        );
      }
      return {
        displayName: claims.name,
        email: claims.email.toLowerCase(),
        emailVerified: claims.email_verified === true,
        issuer: claims.iss,
        preferredUsername:
          typeof claims.preferred_username === "string"
            ? claims.preferred_username
            : undefined,
        subject: claims.sub,
      };
    },
  };
};
