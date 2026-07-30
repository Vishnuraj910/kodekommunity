import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../domain/errors.js";

type Transaction = Prisma.TransactionClient;

type IdempotentResult<T> = {
  replayed: boolean;
  statusCode: number;
  value: T;
};

const hashRequest = (request: unknown): string =>
  createHash("sha256").update(JSON.stringify(request)).digest("hex");

export const runIdempotently = async <T>(
  prisma: PrismaClient,
  input: {
    actorUserId: string;
    key: string;
    action: string;
    request: unknown;
    statusCode: number;
  },
  operation: (transaction: Transaction) => Promise<T>,
): Promise<IdempotentResult<T>> =>
  prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`${input.actorUserId}:${input.action}:${input.key}`})
      )
    `;

    const requestHash = hashRequest(input.request);
    const existing = await transaction.idempotencyRecord.findUnique({
      where: {
        actorUserId_key_action: {
          actorUserId: input.actorUserId,
          key: input.key,
          action: input.action,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for a different request",
        );
      }
      return {
        replayed: true,
        statusCode: existing.statusCode,
        value: existing.response as T,
      };
    }

    const value = await operation(transaction);
    await transaction.idempotencyRecord.create({
      data: {
        actorUserId: input.actorUserId,
        key: input.key,
        action: input.action,
        requestHash,
        statusCode: input.statusCode,
        response: value as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    return { replayed: false, statusCode: input.statusCode, value };
  });
