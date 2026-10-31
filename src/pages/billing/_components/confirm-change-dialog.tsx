import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Plan } from '@/schema/validators';

const PLAN_NAMES = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
};

export default function ConfirmChangeDialog({
  open,
  onClose,
  onConfirm,
  plan,
  interval,
  currentPlan,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  plan: Plan;
  interval: 'month' | 'year';
  currentPlan: Plan;
  loading: boolean;
}) {
  const isUpgrade = plan !== 'free';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isUpgrade ? 'Upgrade' : 'Change'} to {PLAN_NAMES[plan]}
          </DialogTitle>
          <DialogDescription>
            You're about to change from {PLAN_NAMES[currentPlan]} to {PLAN_NAMES[plan]}.
            {isUpgrade && (
              <> This will redirect you to Stripe to complete your purchase.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner /> : 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
