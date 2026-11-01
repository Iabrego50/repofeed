import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get session from URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          setError(error.message);
          return;
        }

        if (data.session) {
          // Create or update user record
          const { error: upsertError } = await supabase
            .from('users')
            .upsert({
              id: data.session.user.id,
              email: data.session.user.email,
              name: data.session.user.user_metadata?.name,
              avatar: data.session.user.user_metadata?.avatar_url,
              token_identifier: data.session.user.id,
            }, {
              onConflict: 'id',
            });

          if (upsertError) {
            console.error('Failed to create user:', upsertError);
          }

          // Redirect to home
          navigate('/');
        } else {
          setError('No session found');
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        setError(err.message);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Authentication Error</h1>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Signing you in...</h1>
        <p className="mt-2">Please wait while we complete your sign in.</p>
      </div>
    </div>
  );
}
