import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function OnboardingTour() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!user) return;

    api.users.current()
      .then((profile) => {
        setUserProfile(profile);
        setShowTour(!profile?.onboardedAt);
      })
      .catch((err) => {
        console.error('Failed to load user profile:', err);
      });
  }, [user]);

  const completeTour = async () => {
    if (!user) return;

    try {
      await api.users.update({
        onboardedAt: new Date().toISOString(),
      });
      setShowTour(false);
    } catch (err) {
      console.error('Failed to complete tour:', err);
    }
  };

  if (!showTour) return null;

  return (
    <div className="onboarding-tour">
      <h2>Welcome to Repofeed!</h2>
      <p>Let's get you started...</p>
      <button onClick={completeTour}>Complete Tour</button>
    </div>
  );
}
