import { useState, useEffect } from 'react';
import { useWorkspace } from '@/lib/workspace';
import { api } from '@/lib/api';
import { isBillingUnavailable } from '@/lib/billing/client';
import type { Plan } from '@/schema/validators';

export function usePlan() {
  const { current } = useWorkspace();
  const [remote, setRemote] = useState<{ plan: Plan; unavailable: boolean } | null>(null);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    api.billing.getPlan({ workspaceId: current._id })
      .then((result) => {
        if (!cancelled) setRemote({ plan: result.plan as Plan, unavailable: false });
      })
      .catch((err) => {
        console.error('Failed to load plan:', err);
        if (!cancelled) setRemote({ plan: 'free', unavailable: isBillingUnavailable(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  if (!current) {
    return { plan: 'free' as Plan, loading: false, unavailable: false };
  }

  return {
    plan: remote?.plan ?? 'free',
    loading: remote === null,
    unavailable: remote?.unavailable ?? false,
  };
}
