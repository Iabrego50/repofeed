// Auth UI components
import { useAuth } from '@/lib/auth';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

interface SignInButtonProps extends Omit<ButtonProps, 'onClick'> {
  signInText?: string;
}

export function SignInButton({ signInText = 'Sign in', className, ...props }: SignInButtonProps) {
  const { signIn } = useAuth();
  
  return (
    <Button onClick={() => signIn('google')} className={className} {...props}>
      {signInText}
    </Button>
  );
}
