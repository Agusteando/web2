
import { sendRedirect } from "h3";
import { assertAdsDashboardAccess, readFormBody } from "~/server/utils/ads";
import { updateAdConfig } from "~/server/utils/adsDb";

export default defineEventHandler(async (event) => {
  await assertAdsDashboardAccess(event);

  const body = await readFormBody(event);

  const debug =
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "1" ||
    (process.env.DEBUG_LEGACY ?? "").toLowerCase() === "true";

  const normalizeCheckbox = (value: string | string[] | undefined): boolean => {
    if (Array.isArray(value)) {
      return value.some((v) => v === "1" || v.toLowerCase() === "on" || v.toLowerCase() === "true");
    }
    if (!value) return false;
    const v = value.toString().toLowerCase();
    return v === "1" || v === "on" || v === "true";
  };

  const globalAdsEnabled = normalizeCheckbox(body.global_ads_enabled);
  const adsForInternal = normalizeCheckbox(body.ads_for_internal);
  const adsForPremium = normalizeCheckbox(body.ads_for_premium);
  const adsForDaycare = normalizeCheckbox(body.ads_for_daycare);
  const adsForOrganic = normalizeCheckbox(body.ads_for_organic);

  let rolloutPercentage: number | undefined;
  const rolloutRaw = Array.isArray(body.rollout_percentage)
    ? body.rollout_percentage[0]
    : body.rollout_percentage;

  if (rolloutRaw != null && rolloutRaw !== "") {
    const parsed = Number(rolloutRaw);
    if (Number.isFinite(parsed)) {
      rolloutPercentage = parsed;
    }
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[ads] Dashboard update", {
      globalAdsEnabled,
      adsForInternal,
      adsForPremium,
      adsForDaycare,
      adsForOrganic,
      rolloutPercentage,
    });
  }

  await updateAdConfig({
    global_ads_enabled: globalAdsEnabled,
    ads_for_internal: adsForInternal,
    ads_for_premium: adsForPremium,
    ads_for_daycare: adsForDaycare,
    ads_for_organic: adsForOrganic,
    rollout_percentage: rolloutPercentage,
  });

  return sendRedirect(event, "/ads", 302);
});
