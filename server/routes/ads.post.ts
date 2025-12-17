
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

  const presetRaw = Array.isArray(body.preset) ? body.preset[0] : body.preset;
  let mode: "manual" | "preset" = "manual";

  let globalAdsEnabled: boolean;
  let adsForInternal: boolean;
  let adsForPremium: boolean;
  let adsForDaycare: boolean;
  let adsForOrganic: boolean;

  if (presetRaw && typeof presetRaw === "string" && presetRaw.trim().length > 0) {
    mode = "preset";
    const preset = presetRaw.trim();

    // Presets de segmentación:
    // - daycare-only: solo daycare
    // - daycare-organic: daycare + organic
    // - all-segments: todos los segmentos
    switch (preset) {
      case "daycare-only":
        globalAdsEnabled = true;
        adsForInternal = false;
        adsForPremium = false;
        adsForDaycare = true;
        adsForOrganic = false;
        break;
      case "daycare-organic":
        globalAdsEnabled = true;
        adsForInternal = false;
        adsForPremium = false;
        adsForDaycare = true;
        adsForOrganic = true;
        break;
      case "all-segments":
        globalAdsEnabled = true;
        adsForInternal = true;
        adsForPremium = true;
        adsForDaycare = true;
        adsForOrganic = true;
        break;
      default:
        // Si llega un preset desconocido, caemos a modo manual.
        mode = "manual";
        globalAdsEnabled = normalizeCheckbox(body.global_ads_enabled);
        adsForInternal = normalizeCheckbox(body.ads_for_internal);
        adsForPremium = normalizeCheckbox(body.ads_for_premium);
        adsForDaycare = normalizeCheckbox(body.ads_for_daycare);
        adsForOrganic = normalizeCheckbox(body.ads_for_organic);
        break;
    }
  } else {
    // Modo manual: leemos los checkboxes tal cual.
    globalAdsEnabled = normalizeCheckbox(body.global_ads_enabled);
    adsForInternal = normalizeCheckbox(body.ads_for_internal);
    adsForPremium = normalizeCheckbox(body.ads_for_premium);
    adsForDaycare = normalizeCheckbox(body.ads_for_daycare);
    adsForOrganic = normalizeCheckbox(body.ads_for_organic);
  }

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[ads] Dashboard update", {
      mode,
      preset: presetRaw ?? null,
      globalAdsEnabled,
      adsForInternal,
      adsForPremium,
      adsForDaycare,
      adsForOrganic,
    });
  }

  await updateAdConfig({
    global_ads_enabled: globalAdsEnabled,
    ads_for_internal: adsForInternal,
    ads_for_premium: adsForPremium,
    ads_for_daycare: adsForDaycare,
    ads_for_organic: adsForOrganic,
  });

  return sendRedirect(event, "/ads", 302);
});
