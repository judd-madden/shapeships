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
  let work: Promise<NameCheckResult> | undefined;
  let run: (() => Promise<NameCheckResult>) | undefined;

  function cancel(): void {
    if (timer !== undefined) timers.clearTimeout(timer);
    timer = undefined;
    sequence++;
    work = undefined;
    run = undefined;
    invalidate();
  }

  function schedule(name: string, immediate: boolean): void {
    if (disposed || currentName === name) return;
    cancel();
    currentName = name;
    const captured = sequence;
    onResult(name, null);
    if (!isValidAccountName(name)) return;
    run = () => {
      if (work) return work;
      if (timer !== undefined) timers.clearTimeout(timer);
      timer = undefined;
      work = (async () => {
        let result: NameCheckResult = null;
        try { result = await checkName(name); } catch { /* Lookup failures never block guests. */ }
        if (disposed || sequence !== captured || currentName !== name) return null;
        onResult(name, result);
        return result;
      })();
      return work;
    };
    if (immediate) void run();
    else timer = timers.setTimeout(() => { void run?.(); }, 500);
  }

  return {
    open: (name: string) => schedule(name, true),
    update: (name: string) => schedule(name, false),
    flush(name: string): Promise<NameCheckResult> {
      if (disposed || !isValidAccountName(name)) return Promise.resolve(null);
      if (currentName !== name || !run) {
        currentName = undefined;
        schedule(name, true);
      }
      return run?.() ?? Promise.resolve(null);
    },
    cancel,
    dispose(): void {
      disposed = true;
      cancel();
    },
  };
}
