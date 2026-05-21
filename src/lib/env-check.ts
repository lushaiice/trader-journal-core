export function validateEnv() {
  const required = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_APP_ENV",
  ] as const;

  const missing: string[] = [];
  for (const key of required) {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      missing.push(key);
    }
  }

  const env =
    ((import.meta.env as Record<string, string | undefined>).VITE_APP_ENV as
      | string
      | undefined) ?? "unknown";

  const sentryDsn = (import.meta.env as Record<string, string | undefined>)
    .VITE_SENTRY_DSN;
  const sentry = sentryDsn && sentryDsn.trim().length > 0 ? "configured" : "missing";

  const ok = missing.length === 0;

  console.info(
    `[env-check] ok=${ok} env=${env} missing=${JSON.stringify(missing)} sentry=${sentry}`,
  );

  return { ok, env, missing, sentry };
}
