// Plan types
export type Plan = 'free' | 'pro' | 'team';

export function isPlan(value: string): value is Plan {
  return ['free', 'pro', 'team'].includes(value);
}

// Re-export all validators
export * from './validators';
