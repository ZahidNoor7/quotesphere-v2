/**
 * SSRF guard for user/tenant-supplied URLs that the server (or a provider on the
 * server's behalf) will fetch — AI provider base URLs, Azure endpoints, vision
 * image URLs, chat attachments. Requires https and rejects loopback / private /
 * link-local / cloud-metadata hosts so a configured URL can't reach internal
 * services. Numeric IP literals (in ANY encoding) and IPv6 literals are rejected
 * outright — legitimate provider endpoints use DNS hostnames, and decimal/hex/
 * octal encodings (e.g. 2130706433, 0x7f000001, 0177.0.0.1) are classic SSRF
 * bypasses for loopback/metadata.
 */

function isPrivateDottedIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const oct = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (oct.some((n) => n > 255)) return true; // malformed → unsafe
  const [a, b] = oct;
  if (a === 0 || a === 10 || a === 127) return true;     // this-host / private / loopback
  if (a === 169 && b === 254) return true;               // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;      // private
  if (a === 192 && b === 168) return true;               // private
  if (a === 100 && b >= 64 && b <= 127) return true;     // CGNAT
  return false;
}

/** True when `raw` is a safe public https URL (not loopback / private / metadata / numeric IP). */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;

  let host = u.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1); // strip a trailing dot
  if (!host) return false;

  // Named loopback / internal suffixes.
  if (
    host === "localhost" ||
    host === "ip6-localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }

  // Reject ALL IPv6 literals (URL hostnames keep the colons) — conservative; real
  // provider endpoints are DNS names.
  if (host.includes(":")) return false;

  // Canonical dotted-quad IPv4 → allow only if it's a public range.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return !isPrivateDottedIPv4(host);

  // Obfuscated numeric IP encodings (decimal int, 0x-hex, octal with leading 0,
  // or dotted with hex/octal labels) → reject; these are SSRF bypasses, not hosts.
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/.test(host)) return false;
  if (host.split(".").some((l) => /^0x[0-9a-f]+$/.test(l) || /^0\d+$/.test(l))) return false;

  // Otherwise it's a normal DNS hostname.
  return true;
}
