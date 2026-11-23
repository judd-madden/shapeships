import type { AccountState } from '../account/types';

/** Names come from validated account identity or this tab's explicit Entry input. */
export function getPlayerName(propsPlayerName: string, account?: AccountState): string {
  if (account?.status === 'signedIn') return account.identity.displayName;
  if (account?.status === 'resuming') return '';
  return propsPlayerName?.trim() ? propsPlayerName : '';
}
