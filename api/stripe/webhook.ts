import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { supabase } from '../_lib/supabase.js';
import { handleStripeEvent } from '../../src/lib/billing/stripe-events.js';

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-09-30.endive',
  });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export { handleStripeEvent };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
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
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
