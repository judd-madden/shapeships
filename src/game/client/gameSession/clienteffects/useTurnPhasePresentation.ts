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
  isBootstrapping: boolean;
  isFinished: boolean;
}

export function useTurnPhasePresentation({
  gameId,
  vm,
  healthResolutionOverlay,
  presentedTurnReleaseKey,
  presentedTurnReleaseTurnNumber,
  isBootstrapping,
  isFinished,
}: Args): TurnPhasePresentationVm {
  const reducedMotion = useReducedMotionPreference();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authoritativelySeededRef = useRef(false);
  const lastReleaseKeyRef = useRef(0);
  const pendingReleaseTurnRef = useRef<number | null>(null);
  const latestTargetRef = useRef<TurnPhaseMilestoneId | null>(null);
  const latestTargetTurnRef = useRef<number | null>(null);
  const contextRef = useRef(vm.context);
  const finishedRef = useRef(isFinished);
  const overlayActiveRef = useRef(healthResolutionOverlay != null);
  const terminalRequestedRef = useRef(false);
  const heartHoldStartedRef = useRef(false);
  const heartHoldCompletedRef = useRef(false);
  const stageRef = useRef<
    'idle' | 'moving' | 'dice_dwell' | 'drawing_move' | 'drawing_dwell' |
    'heart_move' | 'heart_hold' | 'wrap_exit' | 'wrap_reposition' | 'wrap_enter' |
    'terminal_exit'
  >('idle');
  const currentRef = useRef<TurnPhaseMilestoneId | null>(null);
  const currentTurnRef = useRef<number | null>(null);
  const [presentation, setPresentation] = useState<TurnPhasePresentationVm>({
    presentedMilestone: null,
    presentedTurnNumber: null,
    slabPositionIndex: null,
    wrapStage: 'idle',
    headingContext: 'bootstrap',
    movementDurationMs: 0,
    movementEasing: TURN_PHASE_PRESENTATION_TIMING.movementEasing,
    reducedMotion,
  });

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const publish = (
    milestone: TurnPhaseMilestoneId | null,
    turnNumber: number | null,
    slabPositionIndex: number | null,
    movementDurationMs: number,
    wrapStage: TurnPhasePresentationVm['wrapStage'] = 'idle'
  ) => {
    currentRef.current = milestone;
    currentTurnRef.current = turnNumber;
    setPresentation({
      presentedMilestone: milestone,
      presentedTurnNumber: turnNumber,
      slabPositionIndex,
      wrapStage,
      headingContext: contextRef.current,
      movementDurationMs: reducedMotion ? 0 : movementDurationMs,
      movementEasing: TURN_PHASE_PRESENTATION_TIMING.movementEasing,
      reducedMotion,
    });
  };

  const publishMilestone = (
    milestone: TurnPhaseMilestoneId | null,
    turnNumber: number | null,
    animate: boolean
  ) => {
    const duration = animate && !reducedMotion
      ? getTurnPhaseMovementDurationMs(currentRef.current, milestone)
      : 0;
    publish(
      milestone,
      turnNumber,
      getTurnPhaseMilestoneIndex(milestone),
      duration
    );
    return duration;
  };

  const clearPresentation = (turnNumber: number | null) => {
    clearTimer();
    stageRef.current = 'idle';
    heartHoldStartedRef.current = false;
    heartHoldCompletedRef.current = false;
    publish(null, turnNumber, null, 0);
  };

  const beginTerminalExit = () => {
    if (currentRef.current !== 'turn_resolution' || reducedMotion) {
      clearPresentation(currentTurnRef.current ?? latestTargetTurnRef.current);
      return;
    }

    clearTimer();
    stageRef.current = 'terminal_exit';
    publish(
      'turn_resolution',
      currentTurnRef.current,
      5,
      TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.exit,
      'exit'
    );
    timerRef.current = setTimeout(() => {
      clearPresentation(currentTurnRef.current ?? latestTargetTurnRef.current);
    }, TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.exit);
  };

  const continueAfterHeartHold = () => {
    heartHoldCompletedRef.current = true;
    if (terminalRequestedRef.current || (finishedRef.current && !overlayActiveRef.current)) {
      beginTerminalExit();
      return;
    }

    const releasedTurn = pendingReleaseTurnRef.current;
    if (releasedTurn == null) {
      stageRef.current = 'idle';
      return;
    }

    clearTimer();
    stageRef.current = 'wrap_exit';
    publish(
      'turn_resolution',
      currentTurnRef.current,
      5,
      TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.exit,
      'exit'
    );
    timerRef.current = setTimeout(() => {
      const nextTurn = pendingReleaseTurnRef.current;
      if (nextTurn == null || terminalRequestedRef.current) {
        if (terminalRequestedRef.current) beginTerminalExit();
        return;
      }

      stageRef.current = 'wrap_reposition';
      publish('dice_roll', nextTurn, -1, 0, 'reposition');
      timerRef.current = setTimeout(() => {
        stageRef.current = 'wrap_enter';
        publish(
          'dice_roll',
          nextTurn,
          0,
          TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.enter,
          'enter'
        );
        timerRef.current = setTimeout(() => {
          stageRef.current = 'dice_dwell';
          publish('dice_roll', nextTurn, 0, 0);
          timerRef.current = setTimeout(() => {
            stageRef.current = 'idle';
            catchUp();
          }, TURN_PHASE_PRESENTATION_TIMING.minimumVisibleMs.diceRoll);
        }, TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.enter);
      }, 0);
    }, TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.exit);
  };

  const beginHeartHold = () => {
    if (heartHoldStartedRef.current) return;
    heartHoldStartedRef.current = true;
    heartHoldCompletedRef.current = false;
    clearTimer();
    stageRef.current = 'heart_hold';
    timerRef.current = setTimeout(() => {
      continueAfterHeartHold();
    }, TURN_PHASE_PRESENTATION_TIMING.minimumVisibleMs.turnResolution);
  };

  const moveTo = (target: TurnPhaseMilestoneId, turnNumber: number | null) => {
    const duration = publishMilestone(target, turnNumber, true);
    clearTimer();
    if (target === 'turn_resolution') {
      stageRef.current = 'heart_move';
      timerRef.current = setTimeout(beginHeartHold, duration);
      return;
    }

    stageRef.current = 'moving';
    timerRef.current = setTimeout(() => {
      stageRef.current = 'idle';
      catchUp();
    }, duration);
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
      const duration = publishMilestone('drawing', currentTurnRef.current, true);
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
    if (current == null) {
      publishMilestone(target, latestTargetTurnRef.current, false);
      if (target === 'turn_resolution') beginHeartHold();
      return;
    }
    moveTo(target, currentTurnRef.current ?? latestTargetTurnRef.current);
  };

  const authoritativeMilestone = healthResolutionOverlay ? 'turn_resolution' : vm.currentMilestone;
  const authoritativeTurnNumber = healthResolutionOverlay?.displayTurnNumber ?? vm.turnNumber;
  latestTargetRef.current = authoritativeMilestone;
  latestTargetTurnRef.current = authoritativeTurnNumber;
  contextRef.current = vm.context;
  finishedRef.current = isFinished;
  overlayActiveRef.current = healthResolutionOverlay != null;

  useLayoutEffect(() => {
    clearTimer();
    authoritativelySeededRef.current = false;
    lastReleaseKeyRef.current = presentedTurnReleaseKey;
    pendingReleaseTurnRef.current = null;
    terminalRequestedRef.current = false;
    heartHoldStartedRef.current = false;
    heartHoldCompletedRef.current = false;
    stageRef.current = 'idle';
    currentRef.current = null;
    currentTurnRef.current = null;
    setPresentation({
      presentedMilestone: null,
      presentedTurnNumber: null,
      slabPositionIndex: null,
      wrapStage: 'idle',
      headingContext: 'bootstrap',
      movementDurationMs: 0,
      movementEasing: TURN_PHASE_PRESENTATION_TIMING.movementEasing,
      reducedMotion,
    });
  }, [gameId]);

  useLayoutEffect(() => {
    if (
      authoritativelySeededRef.current ||
      !gameId ||
      isBootstrapping ||
      vm.context === 'bootstrap'
    ) {
      return;
    }

    authoritativelySeededRef.current = true;
    lastReleaseKeyRef.current = presentedTurnReleaseKey;
    if (healthResolutionOverlay) {
      publishMilestone('turn_resolution', healthResolutionOverlay.displayTurnNumber, false);
      beginHeartHold();
      return;
    }

    if (isFinished || vm.context === 'species_selection' || vm.currentMilestone == null) {
      clearPresentation(vm.turnNumber);
      return;
    }

    publishMilestone(vm.currentMilestone, vm.turnNumber, false);
  }, [
    gameId,
    healthResolutionOverlay?.presentationKey,
    healthResolutionOverlay?.displayTurnNumber,
    isBootstrapping,
    isFinished,
    presentedTurnReleaseKey,
    vm.context,
    vm.currentMilestone,
    vm.turnNumber,
  ]);

  useLayoutEffect(() => {
    if (!authoritativelySeededRef.current || presentedTurnReleaseKey === lastReleaseKeyRef.current) return;
    lastReleaseKeyRef.current = presentedTurnReleaseKey;
    if (presentedTurnReleaseTurnNumber == null) return;
    pendingReleaseTurnRef.current = presentedTurnReleaseTurnNumber;
    if (currentRef.current === 'turn_resolution' && heartHoldCompletedRef.current) {
      continueAfterHeartHold();
    }
  }, [presentedTurnReleaseKey, presentedTurnReleaseTurnNumber]);

  useLayoutEffect(() => {
    if (!authoritativelySeededRef.current || reducedMotion) return;

    if (isFinished) {
      terminalRequestedRef.current = true;
    }

    if (vm.context === 'species_selection') {
      clearPresentation(null);
      return;
    }

    if (isFinished && !healthResolutionOverlay) {
      if (currentRef.current !== 'turn_resolution') {
        clearPresentation(vm.turnNumber);
      } else if (heartHoldCompletedRef.current) {
        beginTerminalExit();
      } else if (!heartHoldStartedRef.current) {
        beginHeartHold();
      }
      return;
    }

    if (authoritativeMilestone == null || stageRef.current !== 'idle') return;
    if (currentRef.current === 'turn_resolution' && authoritativeMilestone === 'turn_resolution') {
      beginHeartHold();
      return;
    }
    if (currentRef.current == null || authoritativeTurnNumber !== currentTurnRef.current) {
      publishMilestone(authoritativeMilestone, authoritativeTurnNumber, false);
      if (authoritativeMilestone === 'turn_resolution') beginHeartHold();
      return;
    }
    if (getTurnPhaseMilestoneIndex(authoritativeMilestone) < getTurnPhaseMilestoneIndex(currentRef.current)) return;
    catchUp();
  }, [
    authoritativeMilestone,
    authoritativeTurnNumber,
    healthResolutionOverlay?.presentationKey,
    isFinished,
    reducedMotion,
    vm.context,
    vm.turnNumber,
  ]);

  useLayoutEffect(() => {
    if (!reducedMotion || !authoritativelySeededRef.current) return;
    clearTimer();
    stageRef.current = 'idle';
    if (healthResolutionOverlay) {
      publishMilestone('turn_resolution', healthResolutionOverlay.displayTurnNumber, false);
    } else if (isFinished || vm.context === 'species_selection' || vm.currentMilestone == null) {
      clearPresentation(vm.turnNumber);
    } else {
      publishMilestone(vm.currentMilestone, vm.turnNumber, false);
    }
  }, [
    healthResolutionOverlay?.presentationKey,
    healthResolutionOverlay?.displayTurnNumber,
    isFinished,
    reducedMotion,
    vm.context,
    vm.currentMilestone,
    vm.turnNumber,
  ]);

  useEffect(() => () => clearTimer(), []);
  return presentation;
}
