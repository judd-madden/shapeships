import { didUnlockAnyMissionFinding } from './missionFindingUnlocks';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecordCompletedMissionFindingIdsResult {
  completedFindingIds: string[];
  didUnlockMissionFinding: boolean;
}

export const MINIMIZE_MISSIONS_STORAGE_KEY = 'shapeships.minimizeMissions.v1';
export const MISSION_FINDINGS_COMPLETED_STORAGE_KEY =
  'shapeships.missionFindingsCompleted.v1';
export const MISSIONS_COMPLETED_STORAGE_KEY =
  'shapeships.missionsCompleted.v1';
export const LORE_UNREAD_STORAGE_KEY = 'shapeships.loreUnread.v1';

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

export function readCompletedMissionFindingIds(
  storage: StorageLike | null = getSessionStorage(),
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MISSION_FINDINGS_COMPLETED_STORAGE_KEY);
    if (raw === null) return [];
    return normalizeIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readCompletedMissionIds(
  storage: StorageLike | null = getSessionStorage(),
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MISSIONS_COMPLETED_STORAGE_KEY);
    if (raw === null) return [];
    return normalizeIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function recordCompletedMissionId(
  id: string,
  storage: StorageLike | null = getSessionStorage(),
): string[] {
  const completedMissionIds = normalizeIds([
    ...readCompletedMissionIds(storage),
    id,
  ]);
  if (!storage) return completedMissionIds;

  try {
    storage.setItem(
      MISSIONS_COMPLETED_STORAGE_KEY,
      JSON.stringify(completedMissionIds),
    );
  } catch {
    // Completion preference is convenience state and must never interrupt gameplay.
  }

  return completedMissionIds;
}

export function recordCompletedMissionFindingIds(
  ids: readonly string[],
  storage: StorageLike | null = getSessionStorage(),
): RecordCompletedMissionFindingIdsResult {
  const existing = readCompletedMissionFindingIds(storage);
  const result = normalizeIds([...existing, ...ids]);
  const hasNewUnlockedFinding = didUnlockAnyMissionFinding(
    new Set(existing),
    new Set(result),
  );
  if (!storage) {
    return {
      completedFindingIds: result,
      didUnlockMissionFinding: false,
    };
  }

  try {
    storage.setItem(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Discovery is convenience state and must never interrupt gameplay.
    return {
      completedFindingIds: result,
      didUnlockMissionFinding: false,
    };
  }

  if (hasNewUnlockedFinding) {
    try {
      storage.setItem(LORE_UNREAD_STORAGE_KEY, 'true');
    } catch {
      // The completed Finding remains persisted when unread state is unavailable.
    }
  }

  return {
    completedFindingIds: result,
    didUnlockMissionFinding: hasNewUnlockedFinding,
  };
}

export function readLoreUnread(
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(LORE_UNREAD_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearLoreUnread(
  storage: StorageLike | null = getSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(LORE_UNREAD_STORAGE_KEY, 'false');
  } catch {
    // Unread state is presentation-only and must never interrupt navigation.
  }
}
