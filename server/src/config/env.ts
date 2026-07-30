import { z } from "zod";

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}, z.boolean());

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must use PostgreSQL",
      ),
    CLIENT_ORIGIN: z.string().url().default("http://127.0.0.1:4173"),
    SESSION_COOKIE_NAME: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default("kommunity_session"),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
    API_PUBLIC_URL: z.string().url().default("http://127.0.0.1:8787"),
    EMAIL_VERIFICATION_MODE: z.enum(["auto", "email"]).default("auto"),
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(168)
      .default(24),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).max(320).optional(),
    OIDC_ISSUER_URL: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().min(1).max(255).optional(),
    OIDC_CLIENT_SECRET: z.string().min(1).max(2000).optional(),
    OIDC_REDIRECT_URI: z.string().url().optional(),
    OIDC_SCOPES: z.string().default("openid profile email"),
    ALLOW_DEMO_AUTH: booleanFromEnvironment.default(false),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && value.ALLOW_DEMO_AUTH) {
      context.addIssue({
        code: "custom",
        message: "ALLOW_DEMO_AUTH cannot be enabled in production",
        path: ["ALLOW_DEMO_AUTH"],
      });
    }
    if (
      value.NODE_ENV === "production" &&
      value.EMAIL_VERIFICATION_MODE === "auto"
    ) {
      context.addIssue({
        code: "custom",
        message: "Email verification cannot be skipped in production",
        path: ["EMAIL_VERIFICATION_MODE"],
      });
    }
    if (
      value.EMAIL_VERIFICATION_MODE === "email" &&
      (!value.RESEND_API_KEY || !value.EMAIL_FROM)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "RESEND_API_KEY and EMAIL_FROM are required when email verification is enabled",
        path: ["RESEND_API_KEY"],
      });
    }
    if (
      value.NODE_ENV === "production" &&
      (!value.API_PUBLIC_URL.startsWith("https://") ||
        !value.CLIENT_ORIGIN.startsWith("https://"))
    ) {
      context.addIssue({
        code: "custom",
        message: "Public application URLs must use HTTPS in production",
        path: ["API_PUBLIC_URL"],
      });
    }
    const oidcValues = [
      value.OIDC_ISSUER_URL,
      value.OIDC_CLIENT_ID,
      value.OIDC_CLIENT_SECRET,
      value.OIDC_REDIRECT_URI,
    ];
    if (
      oidcValues.some((entry) => entry !== undefined) &&
      oidcValues.some((entry) => entry === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI must be configured together",
        path: ["OIDC_ISSUER_URL"],
      });
    }
  });

export type AppConfig = z.infer<typeof environmentSchema>;

export const loadConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig => environmentSchema.parse(environment);
