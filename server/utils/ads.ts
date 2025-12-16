
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";
import { createError, getCookie, getRequestURL, readBody, setCookie, setHeader } from "h3";
import type { NitroRuntimeConfig } from "nitropack";
import type { AdConfigRow } from "./adsDb";
import { getAdConfig, insertAdVisit } from "./adsDb";
import type { AdDecisionResult, LastLoginType, UserSegment, VisitorContext } from "./adsTypes";

const COOKIE_VISITOR_ID = "visitor_id";
const COOKIE_USER_SEGMENT = "user_segment";
const COOKIE_ADS_SUPPRESSED = "ads_suppressed";
const COOKIE_LAST_LOGIN_TYPE = "last_login_type";

/**
 * Normalize a raw cookie or env string into a boolean or "unknown".
 * This is used both for the env-based hard kill switch and for
 * backwards-compatible index-only env gating.
 */
function normalizeEnvBoolean(raw: string | undefined | null): "true" | "false" | "unknown" {
  if (!raw) return "unknown";
  const value = String(raw).trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(value)) return "true";
  if (["0", "false", "no", "off"].includes(value)) return "false";

  return "unknown";
}

/**
 * Hard env-based kill switch for ALL ads, regardless of DB config.
 *
 * If ENABLE_INDEX_ADS (or NUXT_ENABLE_INDEX_ADS) is explicitly set
 * to a false-y string (0, false, no, off) we treat that as "absolutely
 * no ads", but we still log segmentation + eligibility so the system
 * remains auditable.
 */
export function isEnvAdsHardDisabled(): boolean {
  const raw =
    process.env.ENABLE_INDEX_ADS != null
      ? process.env.ENABLE_INDEX_ADS
      : process.env.NUXT_ENABLE_INDEX_ADS;

  const normalized = normalizeEnvBoolean(raw);
  return normalized === "false";
}

/**
 * Backwards-compatible helper that reads the same env flag the original
 * requirement mentioned (ENABLE_INDEX_ADS / NUXT_ENABLE_INDEX_ADS).
 *
 * This is NO LONGER authoritative for ad rendering; the real control
 * plane is ad_config + the decision engine. However, this helper
 * remains available for any legacy callers.
 */
export function isIndexAdsEnabled(runtimeConfig?: NitroRuntimeConfig): boolean {
  // Prefer explicit runtime config if present.
  // @ts-expect-error runtimeConfig may or may not expose public.enableIndexAds
  const cfgValue = runtimeConfig?.public?.enableIndexAds as unknown;

  const raw =
    (cfgValue as string | undefined) ??
    process.env.ENABLE_INDEX_ADS ??
    process.env.NUXT_ENABLE_INDEX_ADS ??
    "";

  const normalized = normalizeEnvBoolean(raw);
  return normalized === "true";
}

/**
 * Determine the appropriate cookie domain for this request.
 *
 * - In production, this will be ".casitaiedis.edu.mx" (cross-subdomain)
 * - In local/dev, we omit the Domain attribute so cookies stay host-only.
 */
function getCookieDomainForEvent(event: H3Event): string | undefined {
  const url = getRequestURL(event);
  const host = url.hostname.toLowerCase();

  if (host === "casitaiedis.edu.mx" || host.endsWith(".casitaiedis.edu.mx")) {
    return ".casitaiedis.edu.mx";
  }

  // For localhost, previews, etc., fall back to host-only cookies.
  return undefined;
}

function parseUserSegment(raw: string | undefined | null): UserSegment | null {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();

  if (value === "internal" || value === "premium" || value === "daycare" || value === "organic") {
    return value;
  }

  return null;
}

function parseLastLoginType(raw: string | undefined | null): LastLoginType {
  if (!raw) return "unknown";
  const value = String(raw).trim().toLowerCase();

  if (value === "google" || value === "php" || value === "none") {
    return value;
  }

  return "unknown";
}

function parseBooleanCookie(raw: string | undefined | null): boolean {
  const normalized = normalizeEnvBoolean(raw);
  return normalized === "true";
}

/**
 * Timing-safe string comparison to avoid trivial timing attacks
 * against the Basic Auth credentials.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  try {
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/**
 * Ensure visitor_id, user_segment, ads_suppressed and last_login_type
 * cookies exist and are normalized for this request.
 *
 * - New visitors become ORGANIC with ads_suppressed = false, last_login_type = none.
 * - Cookies are set on the apex domain in production (".casitaiedis.edu.mx")
 *   so PHP (login.php) and Node (/login) can share a single segmentation view.
 */
export async function getOrCreateVisitorContext(event: H3Event): Promise<VisitorContext> {
  const debug =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  const domain = getCookieDomainForEvent(event);
  const secure = (process.env.NODE_ENV ?? "development") === "production";

  let visitorId = getCookie(event, COOKIE_VISITOR_ID);
  let userSegment = parseUserSegment(getCookie(event, COOKIE_USER_SEGMENT));
  let adsSuppressed = parseBooleanCookie(getCookie(event, COOKIE_ADS_SUPPRESSED));
  let lastLoginType = parseLastLoginType(getCookie(event, COOKIE_LAST_LOGIN_TYPE));

  let cookiesChanged = false;

  if (!visitorId) {
    visitorId = randomUUID();
    cookiesChanged = true;
  }

  if (!userSegment) {
    // No prior segmentation: treat as ORGANIC, never logged in.
    userSegment = "organic";
    adsSuppressed = false;
    lastLoginType = "none";
    cookiesChanged = true;
  }

  if (!lastLoginType) {
    lastLoginType = "unknown";
    cookiesChanged = true;
  }

  if (cookiesChanged) {
    const cookieOptions = {
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "lax" as const,
      domain,
      maxAge: 60 * 60 * 24 * 365, // one year
    };

    setCookie(event, COOKIE_VISITOR_ID, visitorId, cookieOptions);
    setCookie(event, COOKIE_USER_SEGMENT, userSegment, cookieOptions);
    setCookie(event, COOKIE_ADS_SUPPRESSED, adsSuppressed ? "true" : "false", cookieOptions);
    setCookie(event, COOKIE_LAST_LOGIN_TYPE, lastLoginType, cookieOptions);
  }

  const visitor: VisitorContext = {
    visitorId,
    userSegment,
    adsSuppressed,
    lastLoginType,
  };

  if (debug) {
    // Focused diagnostics to confirm cookie normalization is behaving as expected.
    // eslint-disable-next-line no-console
    console.log("[ads] VisitorContext", {
      visitorId: visitor.visitorId,
      userSegment: visitor.userSegment,
      adsSuppressed: visitor.adsSuppressed,
      lastLoginType: visitor.lastLoginType,
      domain,
    });
  }

  return visitor;
}

/**
 * Deterministic hashing of visitor_id into a bucket 0–99.
 * This is used for rollout_percentage gating:
 *   hash(visitor_id) % 100 < rollout_percentage
 */
export function hashVisitorToBucket(visitorId: string): number {
  const hash = createHash("sha256").update(visitorId).digest();
  // Use the first 4 bytes as a big-endian unsigned int.
  const bucket = hash.readUInt32BE(0) % 100;
  return bucket;
}

/**
 * Core ad decision engine implementing the spec:
 *
 * Inputs:
 *  - visitor (segment, suppression, visitor_id)
 *  - ad_config row
 *
 * Hard locks:
 *  - user_segment == internal  -> NO ADS
 *  - user_segment == premium   -> NO ADS
 *  - ads_suppressed == true    -> NO ADS
 *
 * Global lock:
 *  - global_ads_enabled == 0 or env hard kill -> NO RENDERED ADS
 *
 * Segment toggles:
 *  - daycare allowed only if ads_for_daycare == 1
 *  - organic allowed only if ads_for_organic == 1
 *
 * Rollout gate:
 *  - hash(visitor_id) % 100 < rollout_percentage
 *
 * Output:
 *  - adsEligible: segment + suppression + segment toggles + rollout
 *  - adsRendered: adsEligible + global + env kill
 */
export function computeAdDecision(visitor: VisitorContext, config: AdConfigRow): AdDecisionResult {
  const segment: UserSegment = visitor.userSegment;
  const hardLocked =
    segment === "internal" || segment === "premium" || visitor.adsSuppressed === true;

  if (hardLocked) {
    return { adsEligible: false, adsRendered: false };
  }

  let segmentAllowed = false;

  if (segment === "daycare") {
    segmentAllowed = config.ads_for_daycare === 1;
  } else if (segment === "organic") {
    segmentAllowed = config.ads_for_organic === 1;
  } else {
    // internal and premium are already hard-locked above.
    segmentAllowed = false;
  }

  if (!segmentAllowed) {
    return { adsEligible: false, adsRendered: false };
  }

  const bucket = hashVisitorToBucket(visitor.visitorId);
  const rollout = Number.isFinite(config.rollout_percentage)
    ? Math.max(0, Math.min(100, Number(config.rollout_percentage)))
    : 0;

  const withinRollout = bucket < rollout;
  const adsEligible = withinRollout;

  const envHardDisabled = isEnvAdsHardDisabled();
  const globalEnabled = config.global_ads_enabled === 1 && !envHardDisabled;

  const adsRendered = adsEligible && globalEnabled;

  return { adsEligible, adsRendered };
}

/**
 * Evaluate the ads decision engine for this request, persist an ad_visits row,
 * and return the visitor + config + decision so callers can decide whether
 * to inject ad markup.
 *
 * This is the ONLY entry point pages should use for ad decisions. Anything
 * that renders ads server-side must call this first.
 */
export async function evaluateAdsForEvent(event: H3Event): Promise<{
  visitor: VisitorContext;
  config: AdConfigRow;
  decision: AdDecisionResult;
}> {
  const debug =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  const visitor = await getOrCreateVisitorContext(event);
  const config = await getAdConfig();
  const decision = computeAdDecision(visitor, config);

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[ads] Decision", {
      visitorId: visitor.visitorId,
      userSegment: visitor.userSegment,
      adsSuppressed: visitor.adsSuppressed,
      global_ads_enabled: config.global_ads_enabled,
      ads_for_daycare: config.ads_for_daycare,
      ads_for_organic: config.ads_for_organic,
      rollout_percentage: config.rollout_percentage,
      adsEligible: decision.adsEligible,
      adsRendered: decision.adsRendered,
      envHardDisabled: isEnvAdsHardDisabled(),
    });
  }

  try {
    await insertAdVisit({
      visitorId: visitor.visitorId,
      userSegment: visitor.userSegment,
      adsEligible: decision.adsEligible,
      adsRendered: decision.adsRendered,
    });
  } catch (err) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.error("[ads] Failed to insert ad_visits row", err);
    }
  }

  return { visitor, config, decision };
}

/**
 * Restrict /ads dashboard access to internal users via HTTP Basic Auth,
 * backed by .env credentials. If no Basic Auth env vars are configured,
 * we fall back to the older "internal segment or IP allowlist" behavior.
 *
 * BASIC AUTH MODE (recommended for you):
 *   .env:
 *     ADS_DASHBOARD_BASIC_USER=someuser
 *     ADS_DASHBOARD_BASIC_PASS=some-strong-password
 *
 * The browser will show a username/password prompt when accessing /ads.
 */
export function assertAdsDashboardAccess(event: H3Event): void {
  const debug =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  const envUser =
    process.env.ADS_DASHBOARD_BASIC_USER ??
    process.env.NUXT_ADS_DASHBOARD_BASIC_USER ??
    "";
  const envPass =
    process.env.ADS_DASHBOARD_BASIC_PASS ??
    process.env.NUXT_ADS_DASHBOARD_BASIC_PASS ??
    "";

  const basicUser = envUser.trim();
  const basicPass = envPass.trim();
  const basicConfigured = basicUser.length > 0 && basicPass.length > 0;

  if (basicConfigured) {
    const rawAuthHeader = event.node.req.headers["authorization"];
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;

    const challenge = () => {
      setHeader(
        event,
        "WWW-Authenticate",
        'Basic realm="IECS-IEDIS Ads Dashboard", charset="UTF-8"'
      );
      throw createError({
        statusCode: 401,
        statusMessage: "Authentication required",
      });
    };

    if (!authHeader || !authHeader.toString().startsWith("Basic ")) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[ads] Dashboard Basic Auth missing or malformed Authorization header");
      }
      challenge();
    }

    const base64 = authHeader.toString().slice(6).trim();
    let decoded = "";
    try {
      decoded = Buffer.from(base64, "base64").toString("utf8");
    } catch {
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[ads] Dashboard Basic Auth header could not be base64-decoded");
      }
      challenge();
    }

    const sepIndex = decoded.indexOf(":");
    const user = sepIndex >= 0 ? decoded.slice(0, sepIndex) : decoded;
    const pass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : "";

    const okUser = safeEqual(user, basicUser);
    const okPass = safeEqual(pass, basicPass);

    if (!okUser || !okPass) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[ads] Dashboard Basic Auth invalid credentials", {
          user,
        });
      }
      challenge();
    }

    if (debug) {
      // eslint-disable-next-line no-console
      console.log("[ads] Dashboard access granted via HTTP Basic Auth", { user });
    }
    return;
  }

  // FALLBACK: legacy internal-only access using user_segment cookie or IP allowlist.
  const seg = parseUserSegment(getCookie(event, COOKIE_USER_SEGMENT));

  if (seg === "internal") {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log("[ads] Dashboard access granted by user_segment=internal");
    }
    return;
  }

  const allowListRaw = process.env.ADS_DASHBOARD_IP_ALLOWLIST ?? "";
  const allowList = allowListRaw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  let clientIp = "";

  const xff = event.node.req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    clientIp = xff.split(",")[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    clientIp = xff[0].split(",")[0].trim();
  } else {
    clientIp = event.node.req.socket?.remoteAddress ?? "";
  }

  if (allowList.length > 0 && clientIp) {
    if (allowList.includes(clientIp)) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log("[ads] Dashboard access granted by IP allowlist", { clientIp });
      }
      return;
    }
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.warn("[ads] Dashboard access denied", {
      userSegment: seg,
      clientIp,
      allowList,
      basicConfigured,
    });
  }

  throw createError({
    statusCode: 403,
    statusMessage: "Forbidden: Ads dashboard is internal only",
  });
}

/**
 * Helper for the INTERNAL login flow (/login, Google OAuth).
 *
 * Call this AFTER a successful Google login to enforce:
 *   - user_segment   = internal
 *   - ads_suppressed = true
 *   - last_login_type= google
 *
 * The visitor_id cookie is preserved (or created if missing) so
 * the same UUID is used across subdomains.
 */
export function applyInternalLoginCookies(event: H3Event): VisitorContext {
  const domain = getCookieDomainForEvent(event);
  const secure = (process.env.NODE_ENV ?? "development") === "production";

  let visitorId = getCookie(event, COOKIE_VISITOR_ID);
  if (!visitorId) {
    visitorId = randomUUID();
  }

  const cookieOptions = {
    path: "/",
    httpOnly: false,
    secure,
    sameSite: "lax" as const,
    domain,
    maxAge: 60 * 60 * 24 * 365,
  };

  setCookie(event, COOKIE_VISITOR_ID, visitorId, cookieOptions);
  setCookie(event, COOKIE_USER_SEGMENT, "internal", cookieOptions);
  setCookie(event, COOKIE_ADS_SUPPRESSED, "true", cookieOptions);
  setCookie(event, COOKIE_LAST_LOGIN_TYPE, "google", cookieOptions);

  return {
    visitorId,
    userSegment: "internal",
    adsSuppressed: true,
    lastLoginType: "google",
  };
}

/**
 * Helper for the PHP parent login flow (login.php).
 *
 * Pseudocode for PHP side (for reference):
 *
 *   if (strlen($username) === 6) {
 *       // PREMIUM
 *       setcookie("user_segment", "premium", $expiry, "/", ".casitaiedis.edu.mx", true, false);
 *       setcookie("ads_suppressed", "true", $expiry, "/", ".casitaiedis.edu.mx", true, false);
 *   } else {
 *       // DAYCARE
 *       setcookie("user_segment", "daycare", $expiry, "/", ".casitaiedis.edu.mx", true, false);
 *       setcookie("ads_suppressed", "false", $expiry, "/", ".casitaiedis.edu.mx", true, false);
 *   }
 *   setcookie("last_login_type", "php", $expiry, "/", ".casitaiedis.edu.mx", true, false);
 *
 * The Node helper below implements the same logic in case you ever
 * proxy or reimplement login.php in Node.
 */
export async function applyPhpLoginCookiesForUsername(
  event: H3Event,
  username: string
): Promise<VisitorContext> {
  const domain = getCookieDomainForEvent(event);
  const secure = (process.env.NODE_ENV ?? "development") === "production";

  let visitorId = getCookie(event, COOKIE_VISITOR_ID);
  if (!visitorId) {
    visitorId = randomUUID();
  }

  const isPremium = username.length === 6;
  const userSegment: UserSegment = isPremium ? "premium" : "daycare";
  const adsSuppressed = isPremium;

  const cookieOptions = {
    path: "/",
    httpOnly: false,
    secure,
    sameSite: "lax" as const,
    domain,
    maxAge: 60 * 60 * 24 * 365,
  };

  setCookie(event, COOKIE_VISITOR_ID, visitorId, cookieOptions);
  setCookie(event, COOKIE_USER_SEGMENT, userSegment, cookieOptions);
  setCookie(event, COOKIE_ADS_SUPPRESSED, adsSuppressed ? "true" : "false", cookieOptions);
  setCookie(event, COOKIE_LAST_LOGIN_TYPE, "php", cookieOptions);

  return {
    visitorId,
    userSegment,
    adsSuppressed,
    lastLoginType: "php",
  };
}

/**
 * Utility for server routes that expect URL-encoded form submissions
 * and want a strongly-typed body. Currently used only by the /ads
 * dashboard POST handler, but kept generic for reuse.
 */
export async function readFormBody(
  event: H3Event
): Promise<Record<string, string | string[] | undefined>> {
  const body = await readBody<unknown>(event);
  if (body == null || typeof body !== "object") {
    return {};
  }
  return body as Record<string, string | string[] | undefined>;
}
