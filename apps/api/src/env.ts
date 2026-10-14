import "dotenv/config";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const PLACEHOLDER = /replace-with|changeme|change-me|example|secret$/i;

/** In production a weak or copy-pasted placeholder secret is a startup error, not a warning. */
function strongSecret(name: string): string {
  const value = required(name);
  if (isProduction && (value.length < 32 || PLACEHOLDER.test(value))) {
    throw new Error(
      `${name} must be a random string of at least 32 characters in production ` +
        `(generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`
    );
  }
  return value;
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (isProduction && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must list the web app's address(es) in production, e.g. https://app.example.com");
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: strongSecret("JWT_SECRET"),
  orgProvisioningSecret: strongSecret("ORG_PROVISIONING_SECRET"),
  /** Empty in development = allow any origin. In production this is a strict allow-list. */
  corsOrigins,
  /** Set to the number of reverse proxies in front of the API (1 for Caddy/nginx/ALB). */
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  /** Optional public address of this API. When empty, photo links are relative (/files/...) and each app resolves them against the server it is connected to. */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, ""),
  africasTalking: {
    username: process.env.AFRICASTALKING_USERNAME || "",
    apiKey: process.env.AFRICASTALKING_API_KEY || "",
    useSenderId: process.env.AFRICASTALKING_USE_SENDER_ID === "true",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    bucket: process.env.S3_BUCKET || "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    region: process.env.S3_REGION || "us-east-1",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "",
  },
};
