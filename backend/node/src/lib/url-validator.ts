import { AppError } from "./errors";

/**
 * Validates that a URL is safe to make external requests to.
 * Prevents SSRF attacks by blocking requests to internal/private networks.
 */
export function validateExternalUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(400, "INVALID_URL", "Invalid URL format");
  }

  // Only allow http and https schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(400, "INVALID_URL", `URL scheme "${parsed.protocol}" is not allowed. Only http and https are permitted.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "[::0]" ||
    hostname === "[0000::1]"
  ) {
    throw new AppError(400, "SSRF_BLOCKED", "URLs pointing to localhost are not allowed");
  }

  // Parse IP address and check against private/reserved ranges
  if (isPrivateIP(hostname)) {
    throw new AppError(400, "SSRF_BLOCKED", "URLs pointing to private/internal network addresses are not allowed");
  }
}

/**
 * Checks if a hostname is a private/reserved IP address.
 * Covers: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0
 */
function isPrivateIP(hostname: string): boolean {
  // Try to parse as IPv4
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // 0.0.0.0
    if (a === 0 && b === 0 && c === 0 && d === 0) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    // 10.0.0.0/8 (private)
    if (a === 10) return true;

    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 169 && b === 254) return true;
  }

  // Check for IPv6 loopback in bracket notation (already handled above for [::1])
  // Also block IPv4-mapped IPv6 addresses like [::ffff:127.0.0.1]
  if (hostname.startsWith("[")) {
    const inner = hostname.slice(1, -1);

    // ::ffff:x.x.x.x format (IPv4-mapped IPv6)
    const mappedMatch = inner.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
    if (mappedMatch) {
      return isPrivateIP(mappedMatch[1]);
    }
  }

  return false;
}
