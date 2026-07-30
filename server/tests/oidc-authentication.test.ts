import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../src/domain/errors.js";
import {
  beginOidcFlow,
  completeOidcFlow,
} from "../src/services/oidc-authentication.js";

const state = "a-valid-state-value";
const now = new Date();
const flow = {
  stateHash: "hash",
  codeVerifier: "verifier",
  nonce: "nonce",
  expiresAt: new Date(now.getTime() + 60_000),
};
const profile = {
  displayName: "Lee Morgan",
  email: "lee@example.test",
  emailVerified: true,
  issuer: "https://identity.example.test",
  preferredUsername: "lee",
  subject: "subject_1",
};
const activeUser = {
  id: "user_1",
  displayName: "Lee Morgan",
  email: "lee@example.test",
  handle: "lee",
  status: "ACTIVE",
};

const transaction = () => ({
  auditLog: { create: vi.fn().mockResolvedValue({ id: "audit_1" }) },
  oidcIdentity: {
    findUnique: vi.fn(),
    upsert: vi.fn().mockResolvedValue({}),
  },
  session: { create: vi.fn().mockResolvedValue({}) },
  user: {
    create: vi.fn().mockResolvedValue(activeUser),
    findFirst: vi.fn(),
  },
});

const fastify = (
  overrides: {
    consume?: () => Promise<unknown>;
    deleteCount?: number;
    flow?: typeof flow | null;
    transaction?: ReturnType<typeof transaction>;
  } = {},
) => {
  const tx = overrides.transaction ?? transaction();
  return {
    config: {
      OIDC_ISSUER_URL: "https://identity.example.test",
      SESSION_TTL_HOURS: 12,
    },
    oidcClient: {
      authorizationRequest: vi.fn().mockResolvedValue({
        codeVerifier: "verifier",
        nonce: "nonce",
        state,
        url: new URL("https://identity.example.test/authorize"),
      }),
      consumeCallback: vi.fn(
        overrides.consume ??
          (() => Promise.resolve(profile)),
      ),
    },
    prisma: {
      oidcFlow: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({
          count: overrides.deleteCount ?? 1,
        }),
        findUnique: vi.fn().mockResolvedValue(
          overrides.flow === undefined ? flow : overrides.flow,
        ),
      },
      $transaction: vi.fn(async (operation: unknown) =>
        Array.isArray(operation)
          ? Promise.all(operation)
          : (operation as (input: typeof tx) => Promise<unknown>)(tx),
      ),
    },
    tx,
  };
};

describe("OIDC application flow", () => {
  it("starts a short-lived one-time provider flow", async () => {
    const app = fastify();
    await expect(beginOidcFlow(app as never)).resolves.toEqual({
      state,
      url: new URL("https://identity.example.test/authorize"),
    });
    expect(app.prisma.oidcFlow.deleteMany).toHaveBeenCalled();
    expect(app.prisma.oidcFlow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codeVerifier: "verifier",
          nonce: "nonce",
          stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("rejects missing, expired, and concurrently consumed flows", async () => {
    await expect(
      completeOidcFlow(fastify({ flow: null }) as never, new URL("http://local/callback"), state),
    ).rejects.toMatchObject({ code: "INVALID_OIDC_FLOW" });
    await expect(
      completeOidcFlow(
        fastify({ flow: { ...flow, expiresAt: new Date(0) } }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toMatchObject({ code: "INVALID_OIDC_FLOW" });
    await expect(
      completeOidcFlow(
        fastify({ deleteCount: 0 }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toMatchObject({ code: "INVALID_OIDC_FLOW" });
  });

  it("normalizes provider failures without hiding intentional application errors", async () => {
    const providerError = new AppError(401, "PROVIDER_REJECTED", "Rejected");
    await expect(
      completeOidcFlow(
        fastify({ consume: () => Promise.reject(providerError) }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toBe(providerError);
    await expect(
      completeOidcFlow(
        fastify({ consume: () => Promise.reject(new Error("token detail")) }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toMatchObject({ code: "OIDC_CALLBACK_REJECTED" });
  });

  it("requires verified email and the configured issuer", async () => {
    await expect(
      completeOidcFlow(
        fastify({
          consume: () => Promise.resolve({ ...profile, emailVerified: false }),
        }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toMatchObject({ code: "OIDC_IDENTITY_UNVERIFIED" });
    await expect(
      completeOidcFlow(
        fastify({
          consume: () =>
            Promise.resolve({ ...profile, issuer: "https://other.example.test" }),
        }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toMatchObject({ code: "OIDC_IDENTITY_UNVERIFIED" });
  });

  it("logs in an existing subject and records an attributed audit event", async () => {
    const tx = transaction();
    tx.oidcIdentity.findUnique.mockResolvedValue({
      user: activeUser,
    });
    const app = fastify({ transaction: tx });
    await expect(
      completeOidcFlow(app as never, new URL("http://local/callback"), state),
    ).resolves.toMatchObject({
      user: {
        displayName: activeUser.displayName,
        email: activeUser.email,
        handle: activeUser.handle,
      },
    });
    expect(tx.user.findFirst).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "auth.oidc.logged_in" }),
      }),
    );
  });

  it("links an existing verified-email account before creating a new account", async () => {
    const existingTx = transaction();
    existingTx.oidcIdentity.findUnique.mockResolvedValue(null);
    existingTx.user.findFirst.mockResolvedValue(activeUser);
    await completeOidcFlow(
      fastify({ transaction: existingTx }) as never,
      new URL("http://local/callback"),
      state,
    );
    expect(existingTx.user.create).not.toHaveBeenCalled();

    const newTx = transaction();
    newTx.oidcIdentity.findUnique.mockResolvedValue(null);
    newTx.user.findFirst.mockResolvedValue(null);
    const createdApp = fastify({
      consume: () =>
        Promise.resolve({
          ...profile,
          displayName: "  Lee! Morgan  ",
          email: "LEE@EXAMPLE.TEST",
          preferredUsername: undefined,
        }),
      transaction: newTx,
    });
    await completeOidcFlow(
      createdApp as never,
      new URL("http://local/callback"),
      state,
    );
    expect(newTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayName: "Lee! Morgan",
          email: "lee@example.test",
          handle: expect.stringMatching(/^lee_[a-f0-9]{7}$/),
        }),
      }),
    );
    expect(newTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "auth.oidc.registered" }),
      }),
    );
  });

  it("rejects inactive linked users and translates unique-link conflicts", async () => {
    const inactiveTx = transaction();
    inactiveTx.oidcIdentity.findUnique.mockResolvedValue({
      user: { ...activeUser, email: null, status: "DISABLED" },
    });
    await expect(
      completeOidcFlow(
        fastify({ transaction: inactiveTx }) as never,
        new URL("http://local/callback"),
        state,
      ),
    ).rejects.toMatchObject({ code: "IDENTITY_INACTIVE" });

    const app = fastify();
    app.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("conflict", {
        clientVersion: "6",
        code: "P2002",
      }),
    );
    await expect(
      completeOidcFlow(app as never, new URL("http://local/callback"), state),
    ).rejects.toMatchObject({ code: "OIDC_ACCOUNT_CONFLICT" });
  });
});
