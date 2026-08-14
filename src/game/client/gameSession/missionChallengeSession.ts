export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MINIMIZE_MISSIONS_STORAGE_KEY = 'shapeships.minimizeMissions.v1';
export const MISSION_FINDINGS_SEEN_STORAGE_KEY = 'shapeships.missionFindingsSeen.v1';

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      ),
    ),
  );
}

export function readMinimizeMissionsThisSession(
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(MINIMIZE_MISSIONS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeMinimizeMissionsThisSession(
  enabled: boolean,
  storage: StorageLike | null = getSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(MINIMIZE_MISSIONS_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Preference remains updated in memory when persistence is unavailable.
  }
}

export function readSeenMissionFindingIds(
  storage: StorageLike | null = getSessionStorage(),
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MISSION_FINDINGS_SEEN_STORAGE_KEY);
    if (raw === null) return [];
    return normalizeIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function markMissionFindingIdsSeen(
  ids: readonly string[],
  storage: StorageLike | null = getSessionStorage(),
): string[] {
  const existing = readSeenMissionFindingIds(storage);
  const result = normalizeIds([...existing, ...ids]);
  if (!storage) return result;
  try {
    storage.setItem(MISSION_FINDINGS_SEEN_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Discovery is convenience state and must never interrupt gameplay.
  }
  return result;
}
