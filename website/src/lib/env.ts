import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("postgresql://postgres:postgres@localhost:5432/wondersale?schema=public"),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be at least 16 chars")
    .default("dev_super_secret_session_key_32bytes_min!"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().default("rzp_test_placeholder_key_id"),
  RAZORPAY_KEY_SECRET: z.string().default("rzp_test_placeholder_secret"),
  SMS_PROVIDER: z.enum(["console", "msg91", "twilio"]).default("console"),
  S3_BUCKET: z.string().default("wondersale-media"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_REGION: z.string().default("ap-south-1"),
  ADMIN_EMAIL: z.string().email().default("admin@wondersale.in"),
  ADMIN_PASSWORD: z.string().default("Admin@Wondersale123#"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`\n❌ CRITICAL: Environment variables validation failed:\n${errorDetails}\n`);
    throw new Error(`Environment variables validation failed:\n${errorDetails}`);
  }
  return parsed.data;
}

export const env = validateEnv();
