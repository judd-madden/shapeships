import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTurnstileLoader, mountTurnstileWidget, resolveTurnstileSiteKey,
  type TurnstileApi, type TurnstileEnvironment, type TurnstileRenderOptions, type TurnstileWindow,
} from '../../../../components/ui/turnstile/turnstileLoader';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

interface FakeScript {
  src: string;
  async: boolean;
  defer: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  remove: ReturnType<typeof vi.fn>;
}

function setup(env: TurnstileEnvironment = { dev: true }) {
  vi.useFakeTimers();
  const scripts: FakeScript[] = [];
  const createElement = vi.fn(() => {
    const script: FakeScript = { src: '', async: false, defer: false, onload: null, onerror: null, remove: vi.fn() };
    scripts.push(script);
    return script;
  });
  const appendChild = vi.fn();
  const document = { createElement, head: { appendChild } } as unknown as Pick<Document, 'createElement' | 'head'>;
  const window: TurnstileWindow = {};
  let widgetNumber = 0;
  const api: TurnstileApi = {
    ready: vi.fn((callback: () => void) => callback()),
    render: vi.fn((_container: HTMLElement, _options: TurnstileRenderOptions) => `widget-${++widgetNumber}`),
    reset: vi.fn(), remove: vi.fn(),
  };
  const loader = createTurnstileLoader({
    document, window, env,
    timers: {
      setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
    },
  });
  const ready = async () => {
    window.turnstile = api;
    scripts[0].onload?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  const mount = (action: 'claim' | 'sign-in' = 'claim') => {
    const onTokenChange = vi.fn(), onUnavailable = vi.fn();
    const container = {} as HTMLElement;
    const lifecycle = mountTurnstileWidget({ loader, container, action, onTokenChange, onUnavailable });
    return { ...lifecycle, onTokenChange, onUnavailable, container };
  };
  return { loader, api, scripts, createElement, appendChild, window, ready, mount };
}

describe('Turnstile loader without a DOM', () => {
  it('imports without document/window and the factory does not load a script', async () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const module = await import('../../../../components/ui/turnstile/turnstileLoader');
    expect(module.createTurnstileLoader).toBeTypeOf('function');
    const h = setup();
    expect(h.createElement).not.toHaveBeenCalled();
    expect(h.appendChild).not.toHaveBeenCalled();
  });

  it('shares one script and promise across concurrent and later widgets', async () => {
    const h = setup();
    const first = h.loader.load(), second = h.loader.load();
    expect(first).toBe(second);
    expect(h.createElement).toHaveBeenCalledExactlyOnceWith('script');
    expect(h.appendChild).toHaveBeenCalledOnce();
    expect(h.scripts[0]).toMatchObject({
      src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true, defer: true,
    });
    await h.ready();
    expect(await first).toEqual({ api: h.api, siteKey: '1x00000000000000000000AA' });
    expect(h.loader.load()).toBe(first);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for SDK readiness after the script load event', async () => {
    const h = setup();
    let sdkReady: (() => void) | undefined;
    vi.mocked(h.api.ready).mockImplementation((callback) => { sdkReady = callback; });
    const widget = h.mount();
    await h.ready();
    expect(h.api.render).not.toHaveBeenCalled();
    sdkReady?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.api.render).toHaveBeenCalledOnce();
    widget.dispose();
  });

  it('uses a configured key before the DEV fallback', () => {
    expect(resolveTurnstileSiteKey({ dev: true })).toBe('1x00000000000000000000AA');
    expect(resolveTurnstileSiteKey({ dev: true, siteKey: '  configured  ' })).toBe('configured');
    expect(resolveTurnstileSiteKey({ dev: false, siteKey: 'configured' })).toBe('configured');
  });

  it.each([undefined, '', '   '])('production with missing key %s is unavailable without injection', async (siteKey) => {
    const h = setup({ dev: false, siteKey });
    const widget = h.mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.createElement).not.toHaveBeenCalled();
    expect(h.appendChild).not.toHaveBeenCalled();
    expect(widget.onUnavailable).toHaveBeenCalledOnce();
    expect(widget.onTokenChange).toHaveBeenCalledWith(null);
    widget.dispose();
  });

  it('cleans up failed loading and permits a later mount to retry', async () => {
    const h = setup();
    const first = h.loader.load();
    h.scripts[0].onerror?.();
    await expect(first).rejects.toThrow('Turnstile unavailable');
    expect(h.scripts[0].remove).toHaveBeenCalledOnce();
    const second = h.loader.load();
    expect(h.appendChild).toHaveBeenCalledTimes(2);
    h.window.turnstile = h.api;
    h.scripts[1].onload?.();
    await expect(second).resolves.toMatchObject({ api: h.api });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports unavailable after a bounded load timeout', async () => {
    const h = setup(), widget = h.mount();
    await vi.advanceTimersByTimeAsync(11999);
    expect(widget.onUnavailable).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(widget.onUnavailable).toHaveBeenCalledOnce();
    expect(h.scripts[0].remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    widget.dispose();
  });

  it('reports a script that loads without an SDK as unavailable', async () => {
    const h = setup(), widget = h.mount();
    h.scripts[0].onload?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(widget.onUnavailable).toHaveBeenCalledOnce();
    widget.dispose();
  });
});

describe('Turnstile widget lifecycle without React or a DOM', () => {
  it('never renders an unmounted widget after shared loading completes (R2)', async () => {
    const h = setup(), abandoned = h.mount(), active = h.mount('sign-in');
    abandoned.dispose();
    await h.ready();
    expect(h.appendChild).toHaveBeenCalledOnce();
    expect(h.api.render).toHaveBeenCalledExactlyOnceWith(active.container, expect.objectContaining({ action: 'sign-in' }));
    expect(abandoned.onTokenChange).not.toHaveBeenCalled();
    expect(abandoned.onUnavailable).not.toHaveBeenCalled();
    expect(h.api.remove).not.toHaveBeenCalled();
    active.dispose();
    expect(h.api.remove).toHaveBeenCalledExactlyOnceWith('widget-1');
  });

  it('does not render when unmounted while SDK readiness is pending', async () => {
    const h = setup();
    let sdkReady: (() => void) | undefined;
    vi.mocked(h.api.ready).mockImplementation((callback) => { sdkReady = callback; });
    const widget = h.mount();
    await h.ready();
    widget.dispose();
    sdkReady?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.api.render).not.toHaveBeenCalled();
    expect(h.api.remove).not.toHaveBeenCalled();
  });

  it('suppresses failure callbacks after unmount', async () => {
    const h = setup(), widget = h.mount();
    widget.dispose();
    h.scripts[0].onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(widget.onUnavailable).not.toHaveBeenCalled();
    expect(widget.onTokenChange).not.toHaveBeenCalled();
  });

  it('passes the required options and clears tokens on expiry, timeout, error and reset', async () => {
    const h = setup(), widget = h.mount();
    await h.ready();
    const options = vi.mocked(h.api.render).mock.calls[0][1];
    expect(options).toMatchObject({
      sitekey: '1x00000000000000000000AA', action: 'claim', theme: 'dark', size: 'normal',
      'refresh-expired': 'auto', 'response-field': false,
    });
    options.callback('synthetic-proof');
    expect(widget.onTokenChange).toHaveBeenLastCalledWith('synthetic-proof');
    for (const callback of [options['expired-callback'], options['timeout-callback'], options['error-callback']]) {
      callback();
      expect(widget.onTokenChange).toHaveBeenLastCalledWith(null);
    }
    expect(widget.onUnavailable).toHaveBeenCalledOnce();
    widget.reset();
    expect(h.api.reset).toHaveBeenCalledExactlyOnceWith('widget-1');
    widget.dispose();
    const callCount = widget.onTokenChange.mock.calls.length;
    options.callback('stale-proof');
    options['expired-callback']();
    options['error-callback']();
    widget.reset();
    widget.dispose();
    expect(widget.onTokenChange).toHaveBeenCalledTimes(callCount);
    expect(widget.onUnavailable).toHaveBeenCalledOnce();
    expect(h.api.remove).toHaveBeenCalledOnce();
  });

  it('contains render errors and reports unavailable', async () => {
    const h = setup();
    vi.mocked(h.api.render).mockImplementationOnce(() => { throw new Error('SDK failure'); });
    const widget = h.mount();
    await h.ready();
    expect(widget.onUnavailable).toHaveBeenCalledOnce();
    expect(widget.onTokenChange).toHaveBeenLastCalledWith(null);
    widget.dispose();
  });
});
