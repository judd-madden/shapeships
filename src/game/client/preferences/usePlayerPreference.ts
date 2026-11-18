import { useCallback, useSyncExternalStore } from 'react';
import {
  getPlayerPreference,
  getPlayerPreferencesStore,
  PLAYER_PREFERENCE_DEFAULTS,
  type PlayerPreferenceKey,
} from './playerPreferences';

export function usePlayerPreference(key: PlayerPreferenceKey): boolean {
  const subscribe = useCallback((listener: () => void) =>
    getPlayerPreferencesStore().subscribe(key, listener), [key]);
  const getSnapshot = useCallback(() => getPlayerPreference(key), [key]);
  const getServerSnapshot = useCallback(() => PLAYER_PREFERENCE_DEFAULTS[key], [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
