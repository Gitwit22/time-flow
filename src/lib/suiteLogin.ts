/**
 * Suite login URL builder for Timeflow.
 * Redirects to the Nxt Lvl Suite login page with a redirect_to param
 * so the user returns to Timeflow after authenticating.
 */

const SUITE_URL = (import.meta.env.VITE_SUITE_URL as string | undefined) ?? "";
const SUITE_HOST_PRIMARY = "nltops.com";
const SUITE_HOST_FALLBACK = "ntlops.com";

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveSuiteBaseUrl(): string {
  if (SUITE_URL) return SUITE_URL;
  const host = window.location.hostname.toLowerCase();
  if (isLocalhost(host)) return "http://localhost:3000";
  if (host === SUITE_HOST_PRIMARY || host.endsWith(`.${SUITE_HOST_PRIMARY}`)) return `https://${SUITE_HOST_PRIMARY}`;
  if (host === SUITE_HOST_FALLBACK || host.endsWith(`.${SUITE_HOST_FALLBACK}`)) return `https://${SUITE_HOST_FALLBACK}`;
  return `https://${SUITE_HOST_FALLBACK}`;
}

export function getSuiteLoginUrl(returnPath?: string): string {
  const suiteBase = resolveSuiteBaseUrl();
  try {
    const url = new URL("/?auth=signin", suiteBase);
    url.searchParams.set("next", "timeflow");
    if (returnPath) {
      url.searchParams.set("returnTo", returnPath);
    }
    return url.toString();
  } catch {
    return `https://${SUITE_HOST_FALLBACK}/?auth=signin&next=timeflow`;
  }
}
