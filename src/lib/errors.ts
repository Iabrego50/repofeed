// Error handling utilities

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly data?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'An unknown error occurred';
}

export function handleError(err: unknown): never {
  console.error('Error:', err);
  throw err;
}
