export type TurnstileAction = 'claim' | 'sign-in';
export interface TurnstileRenderOptions {
  sitekey: string;
  action: TurnstileAction;
  theme: 'dark';
  size: 'normal';
  'refresh-expired': 'auto';
  'response-field': false;
  callback(token: string): void;
  'expired-callback'(): void;
  'timeout-callback'(): void;
  'error-callback'(): void;
}
export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}
export interface TurnstileWindow { turnstile?: TurnstileApi }
export interface TurnstileEnvironment { dev: boolean; siteKey?: string }
export interface TurnstileTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TEST_SITE_KEY = '1x00000000000000000000AA';

export function resolveTurnstileSiteKey({ dev, siteKey }: TurnstileEnvironment): string | null {
  return siteKey?.trim() || (dev ? TEST_SITE_KEY : null);
}

/** The factory and module import are inert; load() is the only script-loading seam. */
export function createTurnstileLoader({ document, window, timers, env }: {
  document: Pick<Document, 'createElement' | 'head'>;
  window: TurnstileWindow;
  timers: TurnstileTimers;
  env: TurnstileEnvironment;
}) {
  const siteKey = resolveTurnstileSiteKey(env);
  let pending: Promise<{ api: TurnstileApi; siteKey: string }> | null = null;

  return {
    load(): Promise<{ api: TurnstileApi; siteKey: string }> {
      if (!siteKey) return Promise.reject(new Error('Turnstile unavailable'));
      if (pending) return pending;
      pending = new Promise<{ api: TurnstileApi; siteKey: string }>((resolve, reject) => {
        const script = document.createElement('script');
        let settled = false;
        let timeout: unknown;
        const finish = (api?: TurnstileApi) => {
          if (settled) return;
          settled = true;
          timers.clearTimeout(timeout);
          script.onload = null;
          script.onerror = null;
          if (api) resolve({ api, siteKey });
          else {
            script.remove();
            reject(new Error('Turnstile unavailable'));
          }
        };
        script.src = SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          const api = window.turnstile;
          // The script has executed by load. ready() rejects async/dynamic script tags.
          finish(typeof api?.render === 'function' ? api : undefined);
        };
        script.onerror = () => finish();
        timeout = timers.setTimeout(() => finish(), 12000);
        try { document.head.appendChild(script); } catch { finish(); }
      }).catch((error: unknown) => {
        pending = null;
        throw error;
      });
      return pending;
    },
  };
}

export type TurnstileLoader = ReturnType<typeof createTurnstileLoader>;

/** Each call owns its cancellation fence, even while the shared script is pending. */
export function mountTurnstileWidget({ loader, container, action, onTokenChange, onUnavailable }: {
  loader: TurnstileLoader;
  container: HTMLElement;
  action: TurnstileAction;
  onTokenChange(token: string | null): void;
  onUnavailable(): void;
}) {
  let cancelled = false;
  let widgetId: string | undefined;
  let api: TurnstileApi | undefined;
  const clearToken = () => { if (!cancelled) onTokenChange(null); };
  void loader.load().then((loaded) => {
    if (cancelled) return;
    api = loaded.api;
    widgetId = api.render(container, {
      sitekey: loaded.siteKey, action, theme: 'dark', size: 'normal',
      'refresh-expired': 'auto', 'response-field': false,
      callback: (token) => { if (!cancelled) onTokenChange(token); },
      'expired-callback': clearToken,
      'timeout-callback': clearToken,
      'error-callback': () => {
        clearToken();
        if (!cancelled) onUnavailable();
      },
    });
    if (widgetId === undefined) throw new Error('Turnstile unavailable');
  }).catch(() => {
    if (!cancelled) { onTokenChange(null); onUnavailable(); }
  });
  return {
    reset(): void {
      if (cancelled) return;
      onTokenChange(null);
      if (widgetId !== undefined) {
        try { api?.reset(widgetId); } catch { onUnavailable(); }
      }
    },
    dispose(): void {
      cancelled = true;
      if (widgetId !== undefined) api?.remove(widgetId);
      widgetId = undefined;
    },
  };
}
