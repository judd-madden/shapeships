import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  HealthResolutionPresentationVm,
  TurnPhaseContext,
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

interface HeartPresentationOwner {
  presentationKey: string;
  resolvedTurnNumber: number;
  isTerminalTurn: boolean;
}

type PresentationStage =
  | 'idle'
  | 'moving'
  | 'dice_dwell'
  | 'heart_move'
  | 'heart_hold'
  | 'wrap_exit'
  | 'wrap_reposition'
  | 'wrap_enter'
  | 'terminal_exit';

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
  const previousAuthoritativeContextRef = useRef<TurnPhaseContext>('bootstrap');
  const finishedRef = useRef(isFinished);
  const handledHealthPresentationKeyRef = useRef<string | null>(null);
  const pendingHeartOwnerRef = useRef<HeartPresentationOwner | null>(null);
  const activeHeartOwnerRef = useRef<HeartPresentationOwner | null>(null);
  const terminalRequestedRef = useRef(false);
  const heartHoldStartedRef = useRef(false);
  const heartHoldCompletedRef = useRef(false);
  const stageRef = useRef<PresentationStage>('idle');
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

  const resetHeartLifecycleForDice = () => {
    activeHeartOwnerRef.current = null;
    pendingHeartOwnerRef.current = null;
    heartHoldStartedRef.current = false;
    heartHoldCompletedRef.current = false;
    terminalRequestedRef.current = false;
  };

  const clearPresentation = (turnNumber: number | null) => {
    clearTimer();
    stageRef.current = 'idle';
    pendingHeartOwnerRef.current = null;
    activeHeartOwnerRef.current = null;
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

  const beginDiceDwell = (turnNumber: number) => {
    clearTimer();
    stageRef.current = 'dice_dwell';
    publish('dice_roll', turnNumber, 0, 0);
    timerRef.current = setTimeout(() => {
      stageRef.current = 'idle';
      catchUp();
    }, TURN_PHASE_PRESENTATION_TIMING.minimumVisibleMs.diceRoll);
  };

  const continueAfterHeartHold = () => {
    heartHoldCompletedRef.current = true;
    const heartOwner = activeHeartOwnerRef.current;
    const resolvedTurnNumber =
      heartOwner?.resolvedTurnNumber ?? currentTurnRef.current;

    if (heartOwner?.isTerminalTurn || terminalRequestedRef.current) {
      beginTerminalExit();
      return;
    }

    const releasedTurn = pendingReleaseTurnRef.current;
    if (
      releasedTurn == null ||
      resolvedTurnNumber == null ||
      releasedTurn <= resolvedTurnNumber
    ) {
      stageRef.current = 'idle';
      return;
    }

    pendingReleaseTurnRef.current = null;
    clearTimer();

    if (reducedMotion) {
      resetHeartLifecycleForDice();
      beginDiceDwell(releasedTurn);
      return;
    }

    stageRef.current = 'wrap_exit';
    publish(
      'turn_resolution',
      resolvedTurnNumber,
      5,
      TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.exit,
      'exit'
    );
    timerRef.current = setTimeout(() => {
      stageRef.current = 'wrap_reposition';
      publish('dice_roll', releasedTurn, -1, 0, 'reposition');
      timerRef.current = setTimeout(() => {
        stageRef.current = 'wrap_enter';
        publish(
          'dice_roll',
          releasedTurn,
          0,
          TURN_PHASE_PRESENTATION_TIMING.turnWrapMs.enter,
          'enter'
        );
        timerRef.current = setTimeout(() => {
          resetHeartLifecycleForDice();
          beginDiceDwell(releasedTurn);
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
    timerRef.current = setTimeout(
      continueAfterHeartHold,
      TURN_PHASE_PRESENTATION_TIMING.minimumVisibleMs.turnResolution
    );
  };

  const beginHeartPresentation = (owner: HeartPresentationOwner, animate: boolean) => {
    pendingHeartOwnerRef.current = null;
    activeHeartOwnerRef.current = owner;
    heartHoldStartedRef.current = false;
    heartHoldCompletedRef.current = false;
    terminalRequestedRef.current = owner.isTerminalTurn || finishedRef.current;
    clearTimer();
    const duration = publishMilestone('turn_resolution', owner.resolvedTurnNumber, animate);
    stageRef.current = 'heart_move';
    timerRef.current = setTimeout(beginHeartHold, duration);
  };

  const beginPendingHeartPresentation = () => {
    const owner = pendingHeartOwnerRef.current;
    if (owner == null) return false;
    beginHeartPresentation(
      owner,
      currentRef.current != null && currentRef.current !== 'turn_resolution'
    );
    return true;
  };

  const moveTo = (target: TurnPhaseMilestoneId, turnNumber: number | null) => {
    const duration = publishMilestone(target, turnNumber, true);
    clearTimer();
    stageRef.current = 'moving';
    timerRef.current = setTimeout(() => {
      stageRef.current = 'idle';
      catchUp();
    }, duration);
  };

  const catchUp = () => {
    if (beginPendingHeartPresentation()) return;

    if (currentRef.current === 'turn_resolution') {
      if (heartHoldCompletedRef.current) continueAfterHeartHold();
      else if (!heartHoldStartedRef.current) beginHeartHold();
      return;
    }

    const target = latestTargetRef.current;
    const targetTurn = latestTargetTurnRef.current;
    const current = currentRef.current;
    if (target == null || target === current) {
      stageRef.current = 'idle';
      return;
    }

    if (current == null) {
      stageRef.current = 'idle';
      publishMilestone(target, targetTurn, false);
      return;
    }

    // Later turns begin only through the presented-turn release seam. Merely
    // observing a newer server turn must not synthesize a turn-start wrap.
    if (currentTurnRef.current !== targetTurn) {
      stageRef.current = 'idle';
      return;
    }

    if (getTurnPhaseMilestoneIndex(target) < getTurnPhaseMilestoneIndex(current)) {
      stageRef.current = 'idle';
      return;
    }

    moveTo(target, targetTurn);
  };

  // These are the only ongoing authoritative presentation targets. Health is
  // accepted separately as a one-shot presentation event.
  latestTargetRef.current = vm.currentMilestone;
  latestTargetTurnRef.current = vm.turnNumber;
  contextRef.current = vm.context;
  finishedRef.current = isFinished;

  useLayoutEffect(() => {
    clearTimer();
    authoritativelySeededRef.current = false;
    lastReleaseKeyRef.current = presentedTurnReleaseKey;
    pendingReleaseTurnRef.current = null;
    previousAuthoritativeContextRef.current = 'bootstrap';
    handledHealthPresentationKeyRef.current = null;
    pendingHeartOwnerRef.current = null;
    activeHeartOwnerRef.current = null;
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
    previousAuthoritativeContextRef.current = vm.context;

    if (healthResolutionOverlay) {
      const resolvedTurnNumber = healthResolutionOverlay.resolvedTurnNumber;
      const hasSupersedingRelease =
        presentedTurnReleaseTurnNumber != null &&
        presentedTurnReleaseTurnNumber > resolvedTurnNumber;
      const belongsToCurrentPresentation = healthResolutionOverlay.isTerminalTurn
        ? isFinished && (vm.turnNumber == null || vm.turnNumber === resolvedTurnNumber)
        : vm.turnNumber != null &&
          (vm.turnNumber === resolvedTurnNumber || vm.turnNumber === resolvedTurnNumber + 1);

      handledHealthPresentationKeyRef.current = healthResolutionOverlay.presentationKey;
      if (!hasSupersedingRelease && belongsToCurrentPresentation) {
        beginHeartPresentation({
          presentationKey: healthResolutionOverlay.presentationKey,
          resolvedTurnNumber,
          isTerminalTurn: healthResolutionOverlay.isTerminalTurn,
        }, false);
        return;
      }
    }

    if (isFinished || vm.context === 'species_selection' || vm.currentMilestone == null) {
      clearPresentation(vm.context === 'species_selection' ? null : vm.turnNumber);
      return;
    }

    publishMilestone(vm.currentMilestone, vm.turnNumber, false);
  }, [
    gameId,
    healthResolutionOverlay?.presentationKey,
    healthResolutionOverlay?.resolvedTurnNumber,
    healthResolutionOverlay?.isTerminalTurn,
    isBootstrapping,
    isFinished,
    presentedTurnReleaseKey,
    presentedTurnReleaseTurnNumber,
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
    if (!authoritativelySeededRef.current || !healthResolutionOverlay) return;
    if (handledHealthPresentationKeyRef.current === healthResolutionOverlay.presentationKey) return;

    handledHealthPresentationKeyRef.current = healthResolutionOverlay.presentationKey;
    pendingHeartOwnerRef.current = {
      presentationKey: healthResolutionOverlay.presentationKey,
      resolvedTurnNumber: healthResolutionOverlay.resolvedTurnNumber,
      isTerminalTurn: healthResolutionOverlay.isTerminalTurn,
    };

    if (
      currentRef.current === 'turn_resolution' &&
      stageRef.current !== 'moving' &&
      stageRef.current !== 'heart_move'
    ) {
      activeHeartOwnerRef.current = pendingHeartOwnerRef.current;
      pendingHeartOwnerRef.current = null;
      terminalRequestedRef.current =
        healthResolutionOverlay.isTerminalTurn || finishedRef.current;
      if (stageRef.current === 'idle') {
        if (heartHoldCompletedRef.current) continueAfterHeartHold();
        else if (!heartHoldStartedRef.current) beginHeartHold();
      }
      return;
    }

    if (stageRef.current === 'idle') {
      beginPendingHeartPresentation();
    }
  }, [
    healthResolutionOverlay?.presentationKey,
    healthResolutionOverlay?.resolvedTurnNumber,
    healthResolutionOverlay?.isTerminalTurn,
  ]);

  useLayoutEffect(() => {
    if (!authoritativelySeededRef.current) return;

    const previousContext = previousAuthoritativeContextRef.current;
    previousAuthoritativeContextRef.current = vm.context;

    if (vm.context === 'species_selection') {
      terminalRequestedRef.current = false;
      clearPresentation(null);
      return;
    }

    if (
      previousContext === 'species_selection' &&
      vm.context === 'turn' &&
      vm.turnNumber != null &&
      !isFinished
    ) {
      terminalRequestedRef.current = false;
      beginDiceDwell(vm.turnNumber);
      return;
    }

    if (isFinished) {
      terminalRequestedRef.current = true;
      if (currentRef.current === 'turn_resolution') {
        if (stageRef.current === 'idle' && heartHoldCompletedRef.current) {
          continueAfterHeartHold();
        } else if (stageRef.current === 'idle' && !heartHoldStartedRef.current) {
          beginHeartHold();
        }
      } else if (pendingHeartOwnerRef.current == null) {
        clearPresentation(vm.turnNumber);
      }
      return;
    }

    if (stageRef.current !== 'idle') return;
    if (beginPendingHeartPresentation()) return;

    if (currentRef.current === 'turn_resolution') {
      if (heartHoldCompletedRef.current) continueAfterHeartHold();
      else if (!heartHoldStartedRef.current) beginHeartHold();
      return;
    }

    catchUp();
  }, [
    isFinished,
    vm.context,
    vm.currentMilestone,
    vm.turnNumber,
  ]);

  useLayoutEffect(() => {
    setPresentation((current) => ({
      ...current,
      movementDurationMs: reducedMotion ? 0 : current.movementDurationMs,
      reducedMotion,
    }));
  }, [reducedMotion]);

  useEffect(() => () => clearTimer(), []);
  return presentation;
}
