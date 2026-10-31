// Auth UI components
import { useAuth } from '@/lib/auth';
import { Button } from './button';

export function SignInButton() {
  const { signIn } = useAuth();
  
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => signIn('google')}>Sign in with Google</Button>
      <Button onClick={() => signIn('azure')} variant="outline">Sign in with Microsoft</Button>
      <Button onClick={() => signIn('apple')} variant="outline">Sign in with Apple</Button>
    </div>
  );
}
