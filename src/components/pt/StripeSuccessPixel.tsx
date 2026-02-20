"use client";

import { useEffect, useRef } from "react";
import { trackMetaEvent, getTierPriceGbp } from "@/lib/meta";

const STORAGE_KEY_START_TRIAL = "meta_pixel_start_trial";
const STORAGE_KEY_PURCHASE = "meta_pixel_purchase";

type Props = {
  success: boolean;
  sessionId: string | null;
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
};

/**
 * Fires Meta Pixel StartTrial or Purchase on Stripe success page, once per checkout.
 * Only runs client-side; uses sessionStorage to avoid double-firing on refresh.
 */
export default function StripeSuccessPixel({
  success,
  sessionId,
  subscriptionStatus,
  subscriptionTier,
}: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !success || !sessionId?.trim()) return;
    if (fired.current) return;

    const keyTrial = `${STORAGE_KEY_START_TRIAL}_${sessionId}`;
    const keyPurchase = `${STORAGE_KEY_PURCHASE}_${sessionId}`;

    if (subscriptionStatus === "trial") {
      if (sessionStorage.getItem(keyTrial)) return;
      trackMetaEvent("StartTrial");
      sessionStorage.setItem(keyTrial, "1");
      fired.current = true;
      return;
    }

    if (subscriptionStatus === "active") {
      if (sessionStorage.getItem(keyPurchase)) return;
      const value = getTierPriceGbp(subscriptionTier);
      trackMetaEvent("Purchase", {
        value: value ?? 0,
        currency: "GBP",
      });
      sessionStorage.setItem(keyPurchase, "1");
      fired.current = true;
    }
  }, [success, sessionId, subscriptionStatus, subscriptionTier]);

  return null;
}
