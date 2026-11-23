import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  createTurnstileLoader, mountTurnstileWidget,
  type TurnstileAction, type TurnstileLoader, type TurnstileWindow,
} from './turnstileLoader';

export interface TurnstileWidgetHandle { reset(): void }
interface TurnstileWidgetProps {
  action: TurnstileAction;
  onTokenChange(token: string | null): void;
  onUnavailable(): void;
}

let browserLoader: TurnstileLoader | undefined;
function getBrowserLoader(): TurnstileLoader {
  // Only called by a mounted widget's effect. Guests and module imports stay inert.
  browserLoader ??= createTurnstileLoader({
    document,
    window: window as Window & TurnstileWindow,
    timers: {
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (handle) => window.clearTimeout(handle as number),
    },
    env: { dev: import.meta.env.DEV, siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY },
  });
  return browserLoader;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { action, onTokenChange, onUnavailable }, ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lifecycleRef = useRef<ReturnType<typeof mountTurnstileWidget> | null>(null);
  const callbacks = useRef({ onTokenChange, onUnavailable });
  callbacks.current = { onTokenChange, onUnavailable };
  useImperativeHandle(ref, () => ({ reset: () => lifecycleRef.current?.reset() }), []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    callbacks.current.onTokenChange(null);
    const lifecycle = mountTurnstileWidget({
      loader: getBrowserLoader(), container, action,
      onTokenChange: (token) => callbacks.current.onTokenChange(token),
      onUnavailable: () => callbacks.current.onUnavailable(),
    });
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.dispose();
      lifecycleRef.current = null;
    };
  }, [action]);
  return (
    <div className="flex min-h-[65px] w-full justify-center md:justify-start">
      <div ref={containerRef} className="h-[65px] w-[300px] shrink-0" />
    </div>
  );
});
