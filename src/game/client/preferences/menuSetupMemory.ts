/** Device-local setup memory; deliberately separate from account-synced preferences. */
export type MenuSetupPage = 'playComputer' | 'multiplayer';
export type MenuSetupPresetKey = '5_3' | '10_5' | '15_10' | '30_20';

export interface MenuSetupMemoryRecord {
  timed: boolean;
  presetKey: MenuSetupPresetKey;
}

const STORAGE_KEYS: Record<MenuSetupPage, string> = {
  playComputer: 'shapeships.menuSetup.playComputer.v1',
  multiplayer: 'shapeships.menuSetup.multiplayer.v1',
};

function isSetupRecord(value: unknown): value is MenuSetupMemoryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.timed === 'boolean'
    && (record.presetKey === '5_3' || record.presetKey === '10_5'
      || record.presetKey === '15_10' || record.presetKey === '30_20');
}

export function readMenuSetupMemory(page: MenuSetupPage): MenuSetupMemoryRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[page]);
    if (raw === null) return null;
    const record: unknown = JSON.parse(raw);
    return isSetupRecord(record) ? { timed: record.timed, presetKey: record.presetKey } : null;
  } catch {
    // Missing window, blocked storage and malformed data all use page defaults.
    return null;
  }
}

/** Call only from deliberate user actions, never from initialization or rendering. */
export function writeMenuSetupMemory(page: MenuSetupPage, record: MenuSetupMemoryRecord): void {
  try {
    if (!isSetupRecord(record)) return;
    window.localStorage.setItem(STORAGE_KEYS[page], JSON.stringify({
      timed: record.timed,
      presetKey: record.presetKey,
    }));
  } catch {
    // Storage failure must not interrupt the user's current setup choice.
  }
}
