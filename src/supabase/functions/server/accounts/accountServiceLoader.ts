import type { AccountService } from "./accountService.ts";

export function accountServiceLoader(
  load: () => Promise<AccountService>,
): () => Promise<AccountService> {
  let pending: Promise<AccountService> | undefined;
  return () =>
    pending ??= Promise.resolve().then(load).catch((error) => {
      pending = undefined;
      throw error;
    });
}
