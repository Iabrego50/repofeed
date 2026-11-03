export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback || 'An unexpected error occurred';
}

export function toastError(error: unknown): void {
  console.error('Error:', error);
  // In a real app, integrate with toast library
  alert(getErrorMessage(error));
}

export const errorMessage = getErrorMessage;
