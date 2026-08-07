import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  HealthResolutionPresentationVm,
  TurnPhaseMilestoneId,
  TurnPhasePresentationVm,
  TurnPhaseVm,
} from '../types';
import {
  getTurnPhaseMilestoneIndex,
  getTurnPhaseMovementDurationMs,
  TURN_PHASE_PRESENTATION_TIMING,
} from './turnPhasePresentationTiming';

function readPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(readPrefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reducedMotion;
}

interface Args {
  gameId: string | null;
  vm: TurnPhaseVm;
  healthResolutionOverlay?: HealthResolutionPresentationVm;
  presentedTurnReleaseKey: number;
  presentedTurnReleaseTurnNumber: number | null;
}

export function useTurnPhasePresentation({
  gameId,
  vm,
  healthResolutionOverlay,
  presentedTurnReleaseKey,
  presentedTurnReleaseTurnNumber,
}: Args): TurnPhasePresentationVm {
  const reducedMotion = useReducedMotionPreference();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededGameIdRef = useRef<string | null>(null);
  const lastReleaseKeyRef = useRef(0);
  const pendingReleaseTurnRef = useRef<number | null>(null);
  const latestReleasedTurnRef = useRef<number | null>(null);
  const latestTargetRef = useRef<TurnPhaseMilestoneId | null>(vm.currentMilestone);
  const overlayWasVisibleRef = useRef(false);
  const stageRef = useRef<'idle' | 'dice_dwell' | 'drawing_move' | 'drawing_dwell'>('idle');
  const currentRef = useRef<TurnPhaseMilestoneId | null>(null);
  const currentTurnRef = useRef<number | null>(null);
  const [presentation, setPresentation] = useState<TurnPhasePresentationVm>({
    presentedMilestone: null,
    presentedTurnNumber: null,
    movementDurationMs: 0,
    movementEasing: TURN_PHASE_PRESENTATION_TIMING.movementEasing,
    advancePulseKey: 0,
    reducedMotion,
  });

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const publish = (
    milestone: TurnPhaseMilestoneId | null,
    turnNumber: number | null,
    animate: boolean
  ) => {
    const previous = currentRef.current;
    const duration = animate && !reducedMotion
      ? getTurnPhaseMovementDurationMs(previous, milestone)
      : 0;
    currentRef.current = milestone;
    currentTurnRef.current = turnNumber;
    setPresentation((previousPresentation) => ({
      presentedMilestone: milestone,
      presentedTurnNumber: turnNumber,
      movementDurationMs: duration,
      movementEasing: TURN_PHASE_PRESENTATION_TIMING.movementEasing,
      advancePulseKey:
        animate && !reducedMotion && previous !== milestone
          ? previousPresentation.advancePulseKey + 1
          : previousPresentation.advancePulseKey,
      reducedMotion,
    }));
    return duration;
  };

  const catchUp = () => {
    const target = latestTargetRef.current;
    const current = currentRef.current;
    if (target == null || target === current) {
      stageRef.current = 'idle';
      return;
    }
    if (current === 'dice_roll' && getTurnPhaseMilestoneIndex(target) > 1) {
      stageRef.current = 'drawing_move';
      const duration = publish('drawing', currentTurnRef.current, true);
      clearTimer();
      timerRef.current = setTimeout(() => {
        stageRef.current = 'drawing_dwell';
        timerRef.current = setTimeout(() => {
          stageRef.current = 'idle';
          catchUp();
        }, TURN_PHASE_PRESENTATION_TIMING.minimumVisibleMs.drawing);
      }, duration);
      return;
    }
    publish(target, currentTurnRef.current ?? vm.turnNumber, true);
    stageRef.current = 'idle';
  };

  const beginNewTurn = (releasedTurnNumber: number) => {
    clearTimer();
    currentTurnRef.current = releasedTurnNumber;
    publish('dice_roll', releasedTurnNumber, true);
    if (reducedMotion) {
      stageRef.current = 'idle';
      catchUp();
      return;
    }
    stageRef.current = 'dice_dwell';
    timerRef.current = setTimeout(() => {
      stageRef.current = 'idle';
      catchUp();
    }, TURN_PHASE_PRESENTATION_TIMING.minimumVisibleMs.diceRoll);
  };

  latestTargetRef.current = vm.currentMilestone;

  useLayoutEffect(() => {
    clearTimer();
    seededGameIdRef.current = gameId;
    lastReleaseKeyRef.current = presentedTurnReleaseKey;
    pendingReleaseTurnRef.current = null;
    latestReleasedTurnRef.current = null;
    overlayWasVisibleRef.current = healthResolutionOverlay != null;
    stageRef.current = 'idle';
    const milestone = healthResolutionOverlay ? 'turn_resolution' : vm.currentMilestone;
    const turnNumber = healthResolutionOverlay?.displayTurnNumber ?? vm.turnNumber;
    publish(milestone, turnNumber, false);
    // Reset only when the game identity changes; ordinary state updates use the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useLayoutEffect(() => {
    if (seededGameIdRef.current !== gameId) return;
    if (healthResolutionOverlay) {
      clearTimer();
      stageRef.current = 'idle';
      overlayWasVisibleRef.current = true;
      if (latestReleasedTurnRef.current != null) {
        pendingReleaseTurnRef.current = latestReleasedTurnRef.current;
      }
      publish('turn_resolution', healthResolutionOverlay.displayTurnNumber, false);
      return;
    }

    const overlayJustClosed = overlayWasVisibleRef.current;
    overlayWasVisibleRef.current = false;
    if (overlayJustClosed && pendingReleaseTurnRef.current != null) {
      const releasedTurn = pendingReleaseTurnRef.current;
      pendingReleaseTurnRef.current = null;
      beginNewTurn(releasedTurn);
    } else if (overlayJustClosed && vm.currentMilestone == null) {
      publish(null, null, false);
    }
  }, [healthResolutionOverlay?.presentationKey, healthResolutionOverlay?.displayTurnNumber, gameId]);

  useLayoutEffect(() => {
    if (seededGameIdRef.current !== gameId || presentedTurnReleaseKey === lastReleaseKeyRef.current) return;
    lastReleaseKeyRef.current = presentedTurnReleaseKey;
    if (presentedTurnReleaseTurnNumber == null) return;
    latestReleasedTurnRef.current = presentedTurnReleaseTurnNumber;
    pendingReleaseTurnRef.current = presentedTurnReleaseTurnNumber;
    if (!healthResolutionOverlay) {
      pendingReleaseTurnRef.current = null;
      beginNewTurn(presentedTurnReleaseTurnNumber);
    }
  }, [gameId, healthResolutionOverlay?.presentationKey, presentedTurnReleaseKey, presentedTurnReleaseTurnNumber]);

  useLayoutEffect(() => {
    if (seededGameIdRef.current !== gameId || healthResolutionOverlay || reducedMotion) return;
    if (stageRef.current !== 'idle') return;
    const current = currentRef.current;
    const target = vm.currentMilestone;
    if (target == null || target === current) return;
    if (current == null || vm.turnNumber !== currentTurnRef.current) return;
    if (getTurnPhaseMilestoneIndex(target) < getTurnPhaseMilestoneIndex(current)) return;
    catchUp();
  }, [gameId, healthResolutionOverlay?.presentationKey, reducedMotion, vm.currentMilestone, vm.turnNumber]);

  useLayoutEffect(() => {
    if (!reducedMotion || seededGameIdRef.current !== gameId) return;
    clearTimer();
    stageRef.current = 'idle';
    publish(
      healthResolutionOverlay ? 'turn_resolution' : vm.currentMilestone,
      healthResolutionOverlay?.displayTurnNumber ?? vm.turnNumber,
      false
    );
  }, [gameId, healthResolutionOverlay?.presentationKey, healthResolutionOverlay?.displayTurnNumber, reducedMotion, vm.currentMilestone, vm.turnNumber]);

  useEffect(() => () => clearTimer(), []);
  return presentation;
}
