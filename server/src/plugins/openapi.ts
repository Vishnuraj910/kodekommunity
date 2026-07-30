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
          {
            name: "Authentication",
            description:
              "Preferred OIDC and secondary local credential sessions",
          },
          { name: "Bootstrap", description: "Authenticated client bootstrap" },
          {
            name: "Communities",
            description: "Tenant-aware community membership",
          },
          {
            name: "Groups",
            description: "Tenant-scoped group discovery and administration",
          },
          {
            name: "Posts",
            description: "Member-authored community and group feeds",
          },
          {
            name: "Broadcasts",
            description: "Scheduled community announcements",
          },
          {
            name: "Channels",
            description: "Participant-scoped community and group chat channels",
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
            CookieSession: {
              type: "apiKey",
              in: "cookie",
              name: "kommunity_session",
              description:
                "Opaque server-side session. The cookie is HttpOnly and SameSite=Lax.",
            },
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
