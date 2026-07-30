import type { PrismaClient } from "@prisma/client";
import type { preHandlerHookHandler } from "fastify";
import type { AppConfig } from "../config/env.js";
import type { AuthenticatedIdentity } from "../domain/authorization.js";
import type { OidcClient } from "../services/oidc-client.js";
import type { MessageHub } from "../services/message-hub.js";
import type { VerificationMailer } from "../services/verification-mailer.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    config: AppConfig;
    oidcClient: OidcClient;
    messageHub: MessageHub;
    verificationMailer: VerificationMailer;
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    auth: AuthenticatedIdentity;
  }
}
