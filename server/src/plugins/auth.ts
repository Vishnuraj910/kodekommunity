import fp from "fastify-plugin";
import { AppError } from "../domain/errors.js";
import { toApiRoleAssignment, toApiIdentityStatus } from "../services/mappers.js";
import { resolveSession } from "../services/sessions.js";

export const authPlugin = fp(
  async (fastify) => {
    fastify.decorateRequest("auth");
    fastify.decorate("authenticate", async (request) => {
      const identity = await resolveSession(
        fastify,
        request.cookies[fastify.config.SESSION_COOKIE_NAME],
      );
      if (identity) {
        request.auth = identity;
        return;
      }

      if (!fastify.config.ALLOW_DEMO_AUTH) {
        throw new AppError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication required",
        );
      }

      const rawHeader = request.headers["x-kommunity-user-id"];
      const headerUserId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
      const userId = headerUserId ?? fastify.config.DEMO_USER_ID;
      if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
        throw new AppError(
          401,
          "INVALID_DEMO_IDENTITY",
          "A valid development identity is required",
        );
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          roleAssignments: {
            select: {
              role: true,
              scope: true,
              communityId: true,
              eventId: true,
            },
          },
        },
      });
      if (!user) {
        throw new AppError(401, "IDENTITY_NOT_FOUND", "Identity not found");
      }

      const status = toApiIdentityStatus(user.status);
      if (status !== "active") {
        throw new AppError(
          403,
          "IDENTITY_INACTIVE",
          "This identity cannot access protected capabilities",
        );
      }

      request.auth = {
        id: user.id,
        status,
        assignments: user.roleAssignments.map(toApiRoleAssignment),
      };
    });
  },
  {
    name: "kommunity-auth",
    dependencies: ["kommunity-prisma"],
  },
);
