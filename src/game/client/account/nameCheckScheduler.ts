import { isValidAccountName, type NameCheckResult } from './claimNameForm';

export interface NameCheckTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultTimers: NameCheckTimers = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

/** Input scheduling only. The injected account callback owns all networking. */
export function createNameCheckScheduler({ checkName, invalidate, onResult, timers = defaultTimers }: {
  checkName(name: string): Promise<NameCheckResult>;
  invalidate(): void;
  onResult(name: string, result: NameCheckResult): void;
  timers?: NameCheckTimers;
}) {
  let timer: unknown;
  let sequence = 0;
  let currentName: string | undefined;
  let disposed = false;

  function cancel(): void {
    if (timer !== undefined) timers.clearTimeout(timer);
    timer = undefined;
    sequence++;
    invalidate();
  }

  function schedule(name: string, immediate: boolean): void {
    if (disposed || currentName === name) return;
    cancel();
    currentName = name;
    const captured = sequence;
    onResult(name, null);
    if (!isValidAccountName(name)) return;
    const run = async () => {
      timer = undefined;
      let result: NameCheckResult = null;
      try { result = await checkName(name); } catch { /* Claim remains authoritative on lookup failure. */ }
      if (!disposed && sequence === captured && currentName === name) onResult(name, result);
    };
    if (immediate) void run();
    else timer = timers.setTimeout(() => { void run(); }, 500);
  }

  return {
    open: (name: string) => schedule(name, true),
    update: (name: string) => schedule(name, false),
    cancel,
    dispose(): void {
      disposed = true;
      cancel();
    },
  };
}
