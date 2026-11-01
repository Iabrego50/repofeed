import { useState, useEffect } from 'react';
import { useWorkspace } from '@/lib/workspace';
import { api } from '@/lib/api';
import type { Plan } from '@/schema/validators';

export function usePlan() {
  const { current } = useWorkspace();
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) {
      setPlan('free');
      setLoading(false);
      return;
    }

    api.billing.getPlan({ workspaceId: current._id })
      .then((result) => {
        setPlan(result.plan as Plan);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load plan:', err);
        setPlan('free');
        setLoading(false);
      });
  }, [current]);

  return { plan, loading };
}
