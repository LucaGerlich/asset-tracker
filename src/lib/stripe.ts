import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return _stripe;
}

export const PLANS = {
  starter: {
    name: 'Starter',
    maxAssets: 100,
    maxUsers: 3,
    price: 0,
    priceId: process.env.STRIPE_PRICE_STARTER || null,
  },
  professional: {
    name: 'Professional',
    maxAssets: 5000,
    maxUsers: 25,
    price: 2900, // cents
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || null,
  },
  enterprise: {
    name: 'Enterprise',
    maxAssets: -1, // unlimited
    maxUsers: -1, // unlimited
    price: 9900, // cents
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
