import { useSyncExternalStore } from 'react';
import { getMissionProgressRuntime, type MissionProgressRuntime } from './missionProgressRuntime';

export function useMissionProgress(runtime: MissionProgressRuntime = getMissionProgressRuntime()) {
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  return { ...snapshot, displayedProgress: runtime.getDisplayedProgress(), sync: runtime.sync, reset: runtime.reset };
}
