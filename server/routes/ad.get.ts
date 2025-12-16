
import { sendRedirect } from "h3";

/**
 * Convenience alias:
 *   GET /ad -> 302 redirect to /ads
 *
 * The /ads endpoint is protected by HTTP Basic Auth (configured via
 * ADS_DASHBOARD_BASIC_USER / ADS_DASHBOARD_BASIC_PASS), so the browser
 * will prompt for credentials when you land there.
 */
export default defineEventHandler((event) => {
  const debug =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[ads] Redirecting /ad -> /ads");
  }

  return sendRedirect(event, "/ads", 302);
});
