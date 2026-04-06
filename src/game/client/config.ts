/**
 * Client-side configuration constants
 */

/**
 * Returns the public base URL for the app (used for shareable game links).
 *
 * - Local dev: uses current origin + Vite BASE_URL (usually http://localhost:3000/).
 * - Production subfolder deploys (e.g. https://juddmadden.com/dev/): BASE_URL includes /dev/.
 *
 * IMPORTANT: BASE_URL always ends with a trailing slash in Vite.
 */
export function getPublicAppBaseUrl(): string {
    // Guard for non-browser environments (should not happen in this client app, but keeps it safe).
    if (typeof window === 'undefined') return '';

    const origin = window.location.origin;
    const base = import.meta.env.BASE_URL ?? '/';

    // Ensure base starts with "/" and ends with "/"
    const normalizedBase =
        base.startsWith('/') ? (base.endsWith('/') ? base : `${base}/`) : `/${base}${base.endsWith('/') ? '' : '/'}`;

    return `${origin}${normalizedBase}`;
}

/**
 * Build the shareable game URL using the active game route shape.
 */
export function buildShareGameUrl(gameId: string): string {
    const baseUrl = getPublicAppBaseUrl();
    // If baseUrl is empty (shouldn't happen), fall back to a relative path.
    if (!baseUrl) return `/?game=${encodeURIComponent(gameId)}`;
    return `${baseUrl}?game=${encodeURIComponent(gameId)}`;
}
