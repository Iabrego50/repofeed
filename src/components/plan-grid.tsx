import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import type { Plan } from '@/schema/validators';

const PLANS = [
  {
    id: 'free' as Plan,
    name: 'Free',
    tagline: 'For individuals and small teams',
    price: { month: 0, year: 0 },
    features: [
      '3 active studies',
      '1 editor',
      'Unlimited viewers',
      'Basic features',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    tagline: 'For growing teams',
    price: { month: 29, year: 24 },
    highlight: true,
    features: [
      'Unlimited studies',
      '1 editor',
      'Unlimited viewers',
      'All features',
      'Priority support',
    ],
  },
  {
    id: 'team' as const,
    name: 'Team',
    tagline: 'For larger organizations',
    price: { month: 49, year: 39 },
    features: [
      'Unlimited studies',
      'Unlimited editors',
      'Unlimited viewers',
      'All features',
      'Priority support',
      'Advanced collaboration',
    ],
  },
];

export default function PlanGrid({
  currentPlan,
  onSelect,
  usage,
  trialAvailable,
}: {
  currentPlan: Plan;
  onSelect: (plan: 'pro' | 'team', interval: 'month' | 'year') => void;
  usage: { studies: number; editors: number };
  trialAvailable: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`rounded-lg border p-6 ${plan.highlight ? 'border-primary shadow-lg' : 'border-border'}`}
        >
          {plan.highlight && (
            <div className="mb-4 text-center text-xs font-semibold uppercase text-primary">
              Most Popular
            </div>
          )}
          <h3 className="text-2xl font-bold">{plan.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
          <div className="mt-6 text-4xl font-bold">
            ${plan.price.year}
            <span className="text-lg font-normal text-muted-foreground">/mo</span>
          </div>
          {plan.id !== 'free' && (
            <p className="mt-1 text-sm text-muted-foreground">
              Billed yearly (save 20%)
            </p>
          )}
          <ul className="mt-6 space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {currentPlan === plan.id ? (
              <Button disabled className="w-full">
                Current Plan
              </Button>
            ) : plan.id === 'free' ? (
              <Button variant="outline" disabled className="w-full">
                Downgrade unavailable
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (plan.id !== 'free') {
                    onSelect(plan.id as 'pro' | 'team', 'year');
                  }
                }}
                variant={plan.highlight ? 'default' : 'outline'}
                className="w-full"
              >
                {trialAvailable ? 'Start 14-day trial' : 'Upgrade'}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
