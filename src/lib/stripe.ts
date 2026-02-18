import Stripe from "stripe";

let _instance: Stripe | null = null;

/** Lazy Stripe client so build-time env (no STRIPE_SECRET_KEY) doesn't throw. */
export function getStripe(): Stripe {
  if (!_instance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _instance = new Stripe(key, { apiVersion: "2026-01-28.clover" });
  }
  return _instance;
}
