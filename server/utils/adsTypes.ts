
export type UserSegment = "internal" | "premium" | "daycare" | "organic";

export type LastLoginType = "google" | "php" | "none" | "unknown";

/**
 * Normalized view of all ad-related cookies for a single visitor.
 * This is what the decision engine works with, independent of how
 * the cookies are represented on the wire.
 */
export interface VisitorContext {
  visitorId: string;
  userSegment: UserSegment;
  adsSuppressed: boolean;
  lastLoginType: LastLoginType;
}

/**
 * Result of the server-side ad decision engine for a single request.
 *
 * - adsEligible: visitor passes segment, suppression, and rollout checks
 *                (ignores global kill switches so we can support soak phase).
 * - adsRendered: visitor actually received ad markup on this response
 *                (global + env kill switches applied).
 */
export interface AdDecisionResult {
  adsEligible: boolean;
  adsRendered: boolean;
}
