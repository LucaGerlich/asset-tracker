export interface EnvEmailConfig {
  provider: string;
  fromEmail: string;
  fromName: string;
  hasApiKey: boolean;
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The platform mailer configured through environment variables, as shown on
 * the Email settings tab. It is platform-wide configuration, so it is built
 * only for super-admins: anyone else gets null and nothing reaches their
 * client payload. The API key itself is never included, only whether one is
 * set.
 */
export function getEnvEmailConfig(
  isSuperAdmin: boolean,
  env: Env = process.env,
): EnvEmailConfig | null {
  if (!isSuperAdmin || !env.EMAIL_PROVIDER) return null;

  return {
    provider: env.EMAIL_PROVIDER,
    fromEmail: env.EMAIL_FROM || "",
    fromName: env.EMAIL_FROM_NAME || "Asset Tracker",
    hasApiKey: !!(
      env.BREVO_API_KEY ||
      env.SENDGRID_API_KEY ||
      env.MAILGUN_API_KEY ||
      env.POSTMARK_API_KEY
    ),
  };
}
