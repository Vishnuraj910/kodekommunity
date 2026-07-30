import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

export const prismaPlugin = fp(
  async (fastify) => {
    const prisma = new PrismaClient({
      log:
        fastify.config.NODE_ENV === "development"
          ? ["warn", "error"]
          : ["error"],
    });

    await prisma.$connect();
    fastify.decorate("prisma", prisma);
    fastify.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  },
  { name: "kommunity-prisma" },
);
