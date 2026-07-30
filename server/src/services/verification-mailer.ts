import type { AppConfig } from "../config/env.js";

export type VerificationDelivery = {
  email: string;
  username: string;
  verificationUrl: string;
  idempotencyKey: string;
};

export interface VerificationMailer {
  sendVerificationEmail(delivery: VerificationDelivery): Promise<void>;
}

const resendEndpoint = "https://api.resend.com/emails";

export const createVerificationMailer = (
  config: AppConfig,
): VerificationMailer => ({
  async sendVerificationEmail(delivery) {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(resendEndpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.RESEND_API_KEY}`,
            "content-type": "application/json",
            "idempotency-key": delivery.idempotencyKey,
            "user-agent": "kommunity/0.1",
          },
          body: JSON.stringify({
            from: config.EMAIL_FROM,
            to: [delivery.email],
            subject: "Verify your Kommunity account",
            text: [
              `Welcome to Kommunity, @${delivery.username}.`,
              "",
              "Verify your email address to activate your account:",
              delivery.verificationUrl,
              "",
              `This link expires in ${config.EMAIL_VERIFICATION_TTL_HOURS} hours.`,
            ].join("\n"),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) return;
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new Error(`Email provider returned ${response.status}`);
        if (!retryable) break;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Email delivery failed");
      }
    }
    throw lastError ?? new Error("Email delivery failed");
  },
});
