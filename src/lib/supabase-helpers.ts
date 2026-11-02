import type { PostgrestSingleResponse } from '@supabase/supabase-js';

/**
 * Helper to safely extract data from a Supabase single response
 * Throws an error if the query failed or returned no data
 */
export function unwrapSingle<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) throw response.error;
  if (!response.data) throw new Error('No data returned');
  return response.data;
}

/**
 * Helper to safely extract data from a Supabase single response
 * Returns null if no data (but still throws on error)
 */
export function unwrapSingleOrNull<T>(response: PostgrestSingleResponse<T>): T | null {
  if (response.error) throw response.error;
  return response.data;
}
