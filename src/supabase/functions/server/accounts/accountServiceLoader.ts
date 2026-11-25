import type { AccountService } from "./accountService.ts";

export function accountServiceLoader<T = AccountService>(
  load: () => Promise<T>,
): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    pending ??= Promise.resolve().then(load).catch((error) => {
      pending = undefined;
      throw error;
    });
}
