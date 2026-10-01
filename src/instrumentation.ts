import * as Sentry from "@sentry/nextjs";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const { validateAndLogEnvironment, validateEnvironment } =
      await import("@/lib/env-validation");
    const environmentIsValid = validateAndLogEnvironment();

    // Refuse to boot a production server with missing/invalid required env
    // vars. Skip this during `next build` (NEXT_PHASE is set there but
    // NODE_ENV is also "production") — CI builds run without secrets like
    // CRON_SECRET, and the build itself doesn't need them.
    if (
      !environmentIsValid &&
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD
    ) {
      const { errors } = validateEnvironment();
      throw new Error(
        `Refusing to start: environment validation failed — ${errors.join("; ")}`,
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
