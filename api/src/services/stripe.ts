import Stripe from "stripe";
import { env } from "../lib/env.js";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!env.stripeSecretKey) return null;
  if (!stripe) stripe = new Stripe(env.stripeSecretKey);
  return stripe;
}

export function isStripeEnabled() {
  return Boolean(env.stripeSecretKey);
}
