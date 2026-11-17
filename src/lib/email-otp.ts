/** Supabase mailer OTP length is project-configurable; production may send 6–8 digits. */
export const EMAIL_OTP_MIN_LENGTH = 6;
export const EMAIL_OTP_MAX_LENGTH = 8;

/** Strip spaces, dashes, and other non-digits (e.g. paste of "4056-7273"). */
export function normalizeEmailOtp(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMAIL_OTP_MAX_LENGTH);
}

export function isValidEmailOtp(token: string): boolean {
  return token.length >= EMAIL_OTP_MIN_LENGTH && token.length <= EMAIL_OTP_MAX_LENGTH;
}

/** Auto-submit only when the full 8-digit code is entered; shorter codes need Verify. */
export function shouldAutoSubmitEmailOtp(token: string): boolean {
  return token.length === EMAIL_OTP_MAX_LENGTH;
}
