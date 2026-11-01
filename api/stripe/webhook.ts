import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { requiredEnv, requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { handleStripeEvent } from '../../src/lib/billing/stripe-events.js';

let stripe: Stripe | undefined;

function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-09-30.endive',
    });
  }
  return stripe;
}

function requireWebhookEnv() {
  requiredEnv('STRIPE_SECRET_KEY');
  requiredEnv('STRIPE_WEBHOOK_SECRET');
  requireSupabaseEnv();
}

export { handleStripeEvent };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireWebhookEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, requiredEnv('STRIPE_WEBHOOK_SECRET'));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature';
    console.error('Webhook signature verification failed:', message);
    return res.status(400).json({ error: `Webhook Error: ${message}` });
  }

  try {
    await handleStripeEvent(
      { type: event.type, data: { object: event.data.object as Record<string, unknown> } },
      { retrieve: (id: string) => getStripe().subscriptions.retrieve(id) },
      supabase,
    );
    return res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return sendRouteError(res, error, 'Webhook handler failed');
  }
}
