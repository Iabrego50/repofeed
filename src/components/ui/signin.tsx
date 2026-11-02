import { Link } from 'react-router-dom';
import { Button, type ButtonProps } from './button';

interface SignInButtonProps extends Omit<ButtonProps, 'onClick' | 'asChild'> {
  signInText?: string;
}

/** Sends visitors to the sign-in page instead of starting OAuth on the landing screen. */
export function SignInButton({ signInText = 'Sign in', className, ...props }: SignInButtonProps) {
  return (
    <Button asChild className={className} {...props}>
      <Link to="/signin">{signInText}</Link>
    </Button>
  );
}
