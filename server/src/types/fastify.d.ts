import type { PrismaClient } from "@prisma/client";
import type { preHandlerHookHandler } from "fastify";
import type { AppConfig } from "../config/env.js";
import type { AuthenticatedIdentity } from "../domain/authorization.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    config: AppConfig;
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    auth: AuthenticatedIdentity;
  }
}
