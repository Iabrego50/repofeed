import { describe, expect, it } from "vitest";
import {
  EMAIL_OTP_MAX_LENGTH,
  EMAIL_OTP_MIN_LENGTH,
  isValidEmailOtp,
  normalizeEmailOtp,
  shouldAutoSubmitEmailOtp,
} from "./email-otp";

describe("email OTP helpers", () => {
  it("strips spaces and dashes on paste and caps at 8 digits", () => {
    expect(normalizeEmailOtp("4056-7273")).toBe("40567273");
    expect(normalizeEmailOtp("405 672 73")).toBe("40567273");
    expect(normalizeEmailOtp("12-34-56")).toBe("123456");
    expect(normalizeEmailOtp("1234567890")).toBe("12345678");
    expect(normalizeEmailOtp("abc12")).toBe("12");
  });

  it("accepts 6 to 8 digits only", () => {
    expect(isValidEmailOtp("12345")).toBe(false);
    expect(isValidEmailOtp("123456")).toBe(true);
    expect(isValidEmailOtp("1234567")).toBe(true);
    expect(isValidEmailOtp("12345678")).toBe(true);
    expect(isValidEmailOtp("123456789")).toBe(false);
    expect(EMAIL_OTP_MIN_LENGTH).toBe(6);
    expect(EMAIL_OTP_MAX_LENGTH).toBe(8);
  });

  it("auto-submits only at 8 digits", () => {
    expect(shouldAutoSubmitEmailOtp("123456")).toBe(false);
    expect(shouldAutoSubmitEmailOtp("1234567")).toBe(false);
    expect(shouldAutoSubmitEmailOtp("12345678")).toBe(true);
  });
});
