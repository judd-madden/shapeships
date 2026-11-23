import { useSyncExternalStore } from 'react';
import { getAccountStore, SIGNED_OUT_ACCOUNT_SNAPSHOT } from './accountStore';
import type { AccountSnapshot } from './types';

const subscribe = (listener: () => void) => getAccountStore().subscribe(listener);
const getSnapshot = () => getAccountStore().getSnapshot();
const getServerSnapshot = () => SIGNED_OUT_ACCOUNT_SNAPSHOT;

export function useAccountState(): AccountSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
