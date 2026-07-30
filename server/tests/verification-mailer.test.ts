import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createVerificationMailer } from "../src/services/verification-mailer.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verification mailer", () => {
  it("sends a server-side Resend request with a stable idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createVerificationMailer(
      loadConfig({
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
        EMAIL_VERIFICATION_MODE: "email",
        RESEND_API_KEY: "re_secret",
        EMAIL_FROM: "Kommunity <verify@example.test>",
      } as NodeJS.ProcessEnv),
    );

    await mailer.sendVerificationEmail({
      email: "lee@example.test",
      username: "lee_a1b2c3d4",
      verificationUrl:
        "https://api.example.test/api/v1/auth/verify-email?token=secret",
      idempotencyKey: "token-hash",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer re_secret",
          "idempotency-key": "token-hash",
          "user-agent": "kommunity/0.1",
        }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        from: "Kommunity <verify@example.test>",
        to: ["lee@example.test"],
      }),
    );
  });

  it("retries a transient provider response using the same key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createVerificationMailer(
      loadConfig({
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
        EMAIL_VERIFICATION_MODE: "email",
        RESEND_API_KEY: "re_secret",
        EMAIL_FROM: "verify@example.test",
      } as NodeJS.ProcessEnv),
    );

    await mailer.sendVerificationEmail({
      email: "lee@example.test",
      username: "lee_a1b2c3d4",
      verificationUrl: "https://api.example.test/verify",
      idempotencyKey: "same-key",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({ "idempotency-key": "same-key" }),
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual(
      expect.objectContaining({ "idempotency-key": "same-key" }),
    );
  });

  it("does not retry a permanent provider rejection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createVerificationMailer(
      loadConfig({
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
        EMAIL_VERIFICATION_MODE: "email",
        RESEND_API_KEY: "re_secret",
        EMAIL_FROM: "verify@example.test",
      } as NodeJS.ProcessEnv),
    );

    await expect(
      mailer.sendVerificationEmail({
        email: "lee@example.test",
        username: "lee_a1b2c3d4",
        verificationUrl: "https://api.example.test/verify",
        idempotencyKey: "permanent-key",
      }),
    ).rejects.toThrow("Email provider returned 422");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes non-Error network failures after a bounded retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue("network unavailable");
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createVerificationMailer(
      loadConfig({
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
        EMAIL_VERIFICATION_MODE: "email",
        RESEND_API_KEY: "re_secret",
        EMAIL_FROM: "verify@example.test",
      } as NodeJS.ProcessEnv),
    );

    await expect(
      mailer.sendVerificationEmail({
        email: "lee@example.test",
        username: "lee_a1b2c3d4",
        verificationUrl: "https://api.example.test/verify",
        idempotencyKey: "network-key",
      }),
    ).rejects.toThrow("Email delivery failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves an Error from a failed network retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("provider connection refused"));
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createVerificationMailer(
      loadConfig({
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5433/kommunity",
        EMAIL_VERIFICATION_MODE: "email",
        RESEND_API_KEY: "re_secret",
        EMAIL_FROM: "verify@example.test",
      } as NodeJS.ProcessEnv),
    );

    await expect(
      mailer.sendVerificationEmail({
        email: "lee@example.test",
        username: "lee_a1b2c3d4",
        verificationUrl: "https://api.example.test/verify",
        idempotencyKey: "connection-key",
      }),
    ).rejects.toThrow("provider connection refused");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
