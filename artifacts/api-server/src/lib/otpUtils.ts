/**
 * OTP security utilities — HMAC-SHA256 with SESSION_SECRET.
 *
 * Why HMAC over bcrypt/argon2:
 *   - 6-digit OTPs expire in 30 min and are single-use: the entropy
 *     lives in the secret key, not in the hash cost.
 *   - HMAC is deterministic → O(1) compare without DB round-trip.
 *   - bcrypt/argon2 cost is unnecessary and adds latency for a token
 *     already gated by expiry + max-attempts + IP rate-limit.
 */
import crypto from "node:crypto";

function getKey(): string {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET is not set");
  return key;
}

/**
 * Compute HMAC-SHA256 of a raw OTP using SESSION_SECRET.
 * The result is a 64-char lowercase hex string.
 */
export function hmacOtp(rawOtp: string): string {
  return crypto.createHmac("sha256", getKey()).update(rawOtp).digest("hex");
}

/**
 * Constant-time comparison of two hex strings.
 * Returns false immediately if lengths differ (different algorithm → safe).
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Generic error message for ALL OTP/token failures.
 * Never distinguish between: wrong code / expired / account not found.
 */
export const GENERIC_OTP_ERROR = "Code invalide ou expiré.";

/** Dummy hash — same length as a real HMAC-SHA256 hex, used to prevent timing oracle. */
export const DUMMY_OTP_HASH = "0".repeat(64);
