import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from "fastify-type-provider-zod";

export const openApiPlugin = fp(
  async (fastify) => {
    await fastify.register(swagger, {
      openapi: {
        openapi: "3.0.3",
        info: {
          title: "Kommunity API",
          description:
            "Tenant-aware local API. Protected operations require an active identity and server-side object authorization.",
          version: "0.1.0",
        },
        servers: [{ url: "http://127.0.0.1:8787" }],
        tags: [
          { name: "Health", description: "Liveness and database readiness" },
          { name: "Bootstrap", description: "Authenticated client bootstrap" },
          {
            name: "Communities",
            description: "Tenant-aware community membership",
          },
          { name: "Events", description: "Tenant-aware events and RSVP state" },
          {
            name: "Messages",
            description: "Participant-authorized conversations and messages",
          },
          {
            name: "Access",
            description: "Platform access control and attributed audit events",
          },
        ],
        components: {
          securitySchemes: {
            DemoUser: {
              type: "apiKey",
              in: "header",
              name: "x-kommunity-user-id",
              description:
                "Development-only identity selector. Disabled in production.",
            },
          },
        },
      },
      transform: jsonSchemaTransform,
      transformObject: jsonSchemaTransformObject,
    });
    await fastify.register(swaggerUi, {
      routePrefix: "/docs",
      staticCSP: true,
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
    });
  },
  { name: "kommunity-openapi" },
);
