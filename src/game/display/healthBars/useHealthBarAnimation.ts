import { useSyncExternalStore } from 'react';
import type { HealthBarAnimationController } from './healthBarAnimationController';

/** Ownership belongs to the stable caller, outside orientation-specific renderers. */
export function useHealthBarAnimation(controller: HealthBarAnimationController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
