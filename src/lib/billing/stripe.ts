import Stripe from 'stripe';
import { supabase } from '../supabase';
import type { Plan } from '@/schema';
import { TRIAL_DAYS, teamSeats } from './limits';
export { syncPlanToDatabase } from './sync-plan';

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-09-30.endive',
  });
}

export async function getOrCreateCustomer(workspaceId: string): Promise<string> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('customer_id, name, created_by')
    .eq('id', workspaceId)
    .single();

  if (error || !data) throw new Error('Workspace not found');
  if (data.customer_id) return data.customer_id;

  // Get user email
  const { data: userData } = await supabase
    .from('users')
    .select('email')
    .eq('id', data.created_by)
    .single();

  // Create Stripe customer
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: data.name,
    email: userData?.email || undefined,
    metadata: {
      workspace_id: workspaceId,
    },
  });

  // Save customer ID
  await supabase
    .from('workspaces')
    .update({ customer_id: customer.id })
    .eq('id', workspaceId);

  return customer.id;
}

export async function createCheckoutSession(args: {
  workspaceId: string;
  plan: 'pro' | 'team';
  interval: 'month' | 'year';
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null }> {
  const customerId = await getOrCreateCustomer(args.workspaceId);
  
  // Get editor count for Team seat calculation
  const { count: editorCount } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .in('role', ['owner', 'editor']);

  const quantity = args.plan === 'team' ? teamSeats(editorCount || 1) : 1;

  // Get price ID from env vars
  const priceId = args.plan === 'pro' 
    ? process.env.STRIPE_PRICE_PRO
    : process.env.STRIPE_PRICE_TEAM;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for ${args.plan}`);
  }

  // Check if user has used trial
  const { data: userData } = await supabase
    .from('users')
    .select('trial_used_at')
    .eq('id', args.userId)
    .single();

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    subscription_data: {
      trial_period_days: userData?.trial_used_at ? 0 : TRIAL_DAYS,
      metadata: {
        workspace_id: args.workspaceId,
        plan: args.plan,
      },
    },
    metadata: {
      workspace_id: args.workspaceId,
      user_id: args.userId,
      plan: args.plan,
    },
  });

  // Record checkout attempt
  await supabase
    .from('workspaces')
    .update({
      checkout_by: args.userId,
      billing_return_url: args.cancelUrl,
    })
    .eq('id', args.workspaceId);

  return { url: session.url };
}

export async function createPortalSession(args: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const customerId = await getOrCreateCustomer(args.workspaceId);
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: args.returnUrl,
  });

  return { url: session.url };
}

export async function getPlanFromStripe(customerId: string): Promise<Plan> {
  if (!customerId) return 'free';

  try {
    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) return 'free';

    const subscription = subscriptions.data[0];
    const plan = subscription.metadata.plan as Plan | undefined;

    return plan || 'free';
  } catch (error) {
    console.error('Error fetching plan from Stripe:', error);
    return 'free';
  }
}

export { getStripe as stripe };
