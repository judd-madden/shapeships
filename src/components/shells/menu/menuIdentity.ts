import type { AccountIdentity } from '../../../game/client/account/types';

export type MenuIdentity = {
  status: 'guest' | 'claimed';
  displayName: string;
};

const PREVIEW_STORAGE_KEY = 'shapeships.dev.menuAccountPreview';
let claimedPreview = false;

export function getMenuIdentity(displayName: string, account: AccountIdentity | null = null): MenuIdentity {
  const identity: MenuIdentity = { status: account ? 'claimed' : 'guest', displayName: account?.displayName ?? displayName };
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const preview = new URLSearchParams(window.location.search).get('accountPreview');
    if (preview === 'claimed' || preview === 'guest') {
      claimedPreview = preview === 'claimed';
      try {
        if (claimedPreview) {
          window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, 'claimed');
        } else {
          window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
        }
      } catch {
        // The in-memory preview still survives menu remounts without storage.
      }
    } else {
      try {
        claimedPreview = window.sessionStorage.getItem(PREVIEW_STORAGE_KEY) === 'claimed';
      } catch {
        // Retain the in-memory preview when session storage is unavailable.
      }
    }
    return { ...identity, status: preview === 'guest' ? 'guest' : claimedPreview ? 'claimed' : identity.status };
  }
  return identity;
}
