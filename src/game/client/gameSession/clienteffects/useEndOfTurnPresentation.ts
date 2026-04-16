import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BoardViewModel, HealthResolutionPresentationVm, HealthResolutionSideVm } from '../types';

export interface ContinueAuthoritativePhaseHoldArgs {
  holdSignature: string;
  holdUntilMs: number;
  holdTurnNumber: number;
}

export type ContinueAuthoritativePhaseHoldOutcome = 'released' | 'still_holding' | 'retry';

export interface EndOfTurnHealthPresentationInput {
  boardMode: BoardViewModel['mode'];
  viewerRole: 'player' | 'spectator' | 'unknown';
  meName: string;
  opponentName: string;
  myLastTurnNet: number;
  opponentLastTurnNet: number;
  spectatorHasTwoPlayers: boolean;
  spectatorLeftName: string;
  spectatorRightName: string;
  spectatorLeftNet: number;
  spectatorRightNet: number;
}

export interface EndOfTurnLeftRailInput {
  authoritativeDiceValue: 1 | 2 | 3 | 4 | 5 | 6;
  authoritativeDiceSignature: string | null;
  hasChronoswarmDice: boolean;
}

interface UseEndOfTurnPresentationArgs {
  effectiveGameId: string | null;
  hasMatchingAuthoritativeGameId: boolean;
  phaseKey: string;
  turnNumber: number;
  isBootstrapping: boolean;
  authoritativeHoldPhaseKey: string | null;
  authoritativeHoldReason: string | null;
  authoritativeHoldUntilMs: number | null;
  healthPresentation: EndOfTurnHealthPresentationInput;
  leftRail: EndOfTurnLeftRailInput;
  continueAuthoritativePhaseHold: (
    args: ContinueAuthoritativePhaseHoldArgs
  ) => Promise<ContinueAuthoritativePhaseHoldOutcome>;
}

interface AuthoritativePhaseHoldVm {
  phaseKey: string;
  holdReason: string;
  holdUntilMs: number;
  turnNumber: number;
  signature: string;
}

function clearTimer(timerRef: { current: ReturnType<typeof setTimeout> | null }): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function buildPhaseHoldSignature(args: {
  gameId: string;
  turnNumber: number;
  phaseKey: string;
  holdReason: string;
  holdUntilMs: number;
}): string {
  return JSON.stringify(args);
}

function createHealthResolutionSide(args: {
  subjectName: string;
  net: number;
  useYouCopy: boolean;
}): HealthResolutionSideVm {
  const { subjectName, net, useYouCopy } = args;
  const subject = useYouCopy ? 'You' : subjectName;

  if (net < 0) {
    return {
      prefixText: `${subject} take${useYouCopy ? '' : 's'} `,
      valueText: String(Math.abs(net)),
      suffixText: ' damage',
      valueTone: 'damage',
      valueWeight: 'black',
    };
  }

  if (net > 0) {
    return {
      prefixText: `${subject} heal${useYouCopy ? '' : 's'} `,
      valueText: String(net),
      suffixText: '',
      valueTone: 'heal',
      valueWeight: 'black',
    };
  }

  return {
    prefixText: `${subject} `,
    valueText: '\u00B10',
    suffixText: '',
    valueTone: 'neutral',
    valueWeight: 'regular',
  };
}

function buildHealthResolutionPresentationSnapshot(args: {
  presentationKey: string;
  healthPresentation: EndOfTurnHealthPresentationInput;
}): HealthResolutionPresentationVm | null {
  const { presentationKey, healthPresentation } = args;

  if (healthPresentation.boardMode !== 'board') {
    return null;
  }

  if (healthPresentation.viewerRole === 'player') {
    return {
      presentationKey,
      left: createHealthResolutionSide({
        subjectName: healthPresentation.meName,
        net: healthPresentation.myLastTurnNet,
        useYouCopy: true,
      }),
      right: createHealthResolutionSide({
        subjectName: healthPresentation.opponentName,
        net: healthPresentation.opponentLastTurnNet,
        useYouCopy: false,
      }),
    };
  }

  if (!healthPresentation.spectatorHasTwoPlayers) {
    return null;
  }

  return {
    presentationKey,
    left: createHealthResolutionSide({
      subjectName: healthPresentation.spectatorLeftName,
      net: healthPresentation.spectatorLeftNet,
      useYouCopy: false,
    }),
    right: createHealthResolutionSide({
      subjectName: healthPresentation.spectatorRightName,
      net: healthPresentation.spectatorRightNet,
      useYouCopy: false,
    }),
  };
}

export function useEndOfTurnPresentation(args: UseEndOfTurnPresentationArgs) {
  const {
    effectiveGameId,
    hasMatchingAuthoritativeGameId,
    phaseKey,
    turnNumber,
    isBootstrapping,
    authoritativeHoldPhaseKey,
    authoritativeHoldReason,
    authoritativeHoldUntilMs,
    healthPresentation,
    leftRail,
    continueAuthoritativePhaseHold,
  } = args;

  const phaseHoldContinuationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseHoldContinuationInFlightSignatureRef = useRef<string | null>(null);
  const phaseHoldContinuationCompletedSignatureRef = useRef<string | null>(null);
  const currentAuthoritativeHoldSignatureRef = useRef<string | null>(null);
  const healthResolutionOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenHealthResolutionOverlayHoldSignatureRef = useRef<string | null>(null);
  const activeHealthResolutionOverlayPresentationKeyRef = useRef<string | null>(null);
  const healthResolutionOverlayPresentationSeqRef = useRef(0);
  const pendingAuthoritativeLeftRailDiceRef = useRef<{
    value: 1 | 2 | 3 | 4 | 5 | 6;
    signature: string;
    turnNumber: number;
    hasChronoswarmDice: boolean;
  } | null>(null);
  const lastSeenAuthoritativeLeftRailDiceSignatureRef = useRef<string | null>(null);
  const lastPresentedLeftRailReleaseTurnRef = useRef<number | null>(null);

  const [healthResolutionOverlay, setHealthResolutionOverlay] =
    useState<HealthResolutionPresentationVm | undefined>(undefined);
  const [presentedLeftRailDiceValue, setPresentedLeftRailDiceValue] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [presentedLeftRailDiceAnimateSeq, setPresentedLeftRailDiceAnimateSeq] = useState(0);
  const [presentedTurnTakeoverTurn, setPresentedTurnTakeoverTurn] = useState<number | null>(null);
  const [presentedTurnTakeoverSeq, setPresentedTurnTakeoverSeq] = useState(0);
  const [presentedChronoswarmAnimateSeq, setPresentedChronoswarmAnimateSeq] = useState(0);

  const authoritativePhaseHold: AuthoritativePhaseHoldVm | null =
    effectiveGameId &&
    hasMatchingAuthoritativeGameId &&
    !isBootstrapping &&
    healthPresentation.boardMode === 'board' &&
    phaseKey === 'battle.end_of_turn_resolution' &&
    authoritativeHoldPhaseKey === 'battle.end_of_turn_resolution' &&
    authoritativeHoldReason === 'end_of_turn_health' &&
    typeof authoritativeHoldUntilMs === 'number'
      ? {
          phaseKey: authoritativeHoldPhaseKey,
          holdReason: authoritativeHoldReason,
          holdUntilMs: authoritativeHoldUntilMs,
          turnNumber,
          signature: buildPhaseHoldSignature({
            gameId: effectiveGameId,
            turnNumber,
            phaseKey: authoritativeHoldPhaseKey,
            holdReason: authoritativeHoldReason,
            holdUntilMs: authoritativeHoldUntilMs,
          }),
        }
      : null;

  const healthResolutionLockActive = authoritativePhaseHold != null;
  currentAuthoritativeHoldSignatureRef.current = authoritativePhaseHold?.signature ?? null;

  function schedulePhaseHoldContinuationRetry(
    continuationArgs: ContinueAuthoritativePhaseHoldArgs,
    delayMs: number
  ): void {
    clearTimer(phaseHoldContinuationTimerRef);
    phaseHoldContinuationTimerRef.current = setTimeout(() => {
      phaseHoldContinuationTimerRef.current = null;
      void runPhaseHoldContinuation(continuationArgs);
    }, delayMs);
  }

  async function runPhaseHoldContinuation(
    continuationArgs: ContinueAuthoritativePhaseHoldArgs
  ): Promise<void> {
    const { holdSignature, holdUntilMs } = continuationArgs;

    if (
      currentAuthoritativeHoldSignatureRef.current !== holdSignature ||
      phaseHoldContinuationCompletedSignatureRef.current === holdSignature ||
      phaseHoldContinuationInFlightSignatureRef.current === holdSignature
    ) {
      return;
    }

    phaseHoldContinuationInFlightSignatureRef.current = holdSignature;

    try {
      const outcome = await continueAuthoritativePhaseHold(continuationArgs);
      phaseHoldContinuationInFlightSignatureRef.current = null;

      if (currentAuthoritativeHoldSignatureRef.current !== holdSignature) {
        return;
      }

      if (outcome === 'released') {
        phaseHoldContinuationCompletedSignatureRef.current = holdSignature;
        return;
      }

      schedulePhaseHoldContinuationRetry(
        continuationArgs,
        outcome === 'still_holding'
          ? Math.max(150, holdUntilMs - Date.now() + 50)
          : 400
      );
    } catch {
      phaseHoldContinuationInFlightSignatureRef.current = null;

      if (currentAuthoritativeHoldSignatureRef.current !== holdSignature) {
        return;
      }

      schedulePhaseHoldContinuationRetry(continuationArgs, 400);
    }
  }

  useEffect(() => {
    clearTimer(phaseHoldContinuationTimerRef);
    clearTimer(healthResolutionOverlayTimerRef);
    setHealthResolutionOverlay(undefined);
    setPresentedLeftRailDiceValue(1);
    setPresentedLeftRailDiceAnimateSeq(0);
    setPresentedTurnTakeoverTurn(null);
    setPresentedTurnTakeoverSeq(0);
    setPresentedChronoswarmAnimateSeq(0);
    phaseHoldContinuationInFlightSignatureRef.current = null;
    phaseHoldContinuationCompletedSignatureRef.current = null;
    currentAuthoritativeHoldSignatureRef.current = null;
    lastSeenHealthResolutionOverlayHoldSignatureRef.current = null;
    activeHealthResolutionOverlayPresentationKeyRef.current = null;
    healthResolutionOverlayPresentationSeqRef.current = 0;
    pendingAuthoritativeLeftRailDiceRef.current = null;
    lastSeenAuthoritativeLeftRailDiceSignatureRef.current = null;
    lastPresentedLeftRailReleaseTurnRef.current = null;
  }, [effectiveGameId]);

  useEffect(() => {
    return () => {
      clearTimer(phaseHoldContinuationTimerRef);
      clearTimer(healthResolutionOverlayTimerRef);
    };
  }, []);

  useEffect(() => {
    if (!authoritativePhaseHold) {
      return;
    }

    const holdSignature = authoritativePhaseHold.signature;
    if (lastSeenHealthResolutionOverlayHoldSignatureRef.current === holdSignature) {
      return;
    }

    healthResolutionOverlayPresentationSeqRef.current += 1;
    const presentationKey =
      `${effectiveGameId ?? 'nogame'}::health::${turnNumber}::${healthResolutionOverlayPresentationSeqRef.current}`;
    const nextOverlay = buildHealthResolutionPresentationSnapshot({
      presentationKey,
      healthPresentation,
    });

    if (nextOverlay == null) {
      return;
    }

    lastSeenHealthResolutionOverlayHoldSignatureRef.current = holdSignature;
    activeHealthResolutionOverlayPresentationKeyRef.current = presentationKey;
    setHealthResolutionOverlay(nextOverlay);
    clearTimer(healthResolutionOverlayTimerRef);
    healthResolutionOverlayTimerRef.current = setTimeout(() => {
      healthResolutionOverlayTimerRef.current = null;

      if (activeHealthResolutionOverlayPresentationKeyRef.current !== presentationKey) {
        return;
      }

      activeHealthResolutionOverlayPresentationKeyRef.current = null;
      setHealthResolutionOverlay(undefined);
    }, 3500);
  }, [
    authoritativePhaseHold?.signature,
    effectiveGameId,
    healthPresentation.boardMode,
    healthPresentation.viewerRole,
    healthPresentation.meName,
    healthPresentation.opponentName,
    healthPresentation.myLastTurnNet,
    healthPresentation.opponentLastTurnNet,
    healthPresentation.spectatorHasTwoPlayers,
    healthPresentation.spectatorLeftName,
    healthPresentation.spectatorRightName,
    healthPresentation.spectatorLeftNet,
    healthPresentation.spectatorRightNet,
    turnNumber,
  ]);

  function releasePresentedLeftRailTurn(args: {
    value: 1 | 2 | 3 | 4 | 5 | 6;
    turnNumber: number;
    hasChronoswarmDice: boolean;
    animateMainDie: boolean;
  }): void {
    const { value, turnNumber: nextTurnNumber, hasChronoswarmDice, animateMainDie } = args;

    setPresentedLeftRailDiceValue(value);

    if (!animateMainDie) {
      lastPresentedLeftRailReleaseTurnRef.current = nextTurnNumber;
      return;
    }

    setPresentedLeftRailDiceAnimateSeq((prev) => prev + 1);

    const previousPresentedTurn = lastPresentedLeftRailReleaseTurnRef.current;
    const isNewPresentedTurn =
      previousPresentedTurn == null || nextTurnNumber > previousPresentedTurn;

    lastPresentedLeftRailReleaseTurnRef.current = nextTurnNumber;

    if (!isNewPresentedTurn) {
      return;
    }

    setPresentedTurnTakeoverTurn(nextTurnNumber);
    setPresentedTurnTakeoverSeq((prev) => prev + 1);

    if (hasChronoswarmDice) {
      setPresentedChronoswarmAnimateSeq((prev) => prev + 1);
    }
  }

  useLayoutEffect(() => {
    if (!effectiveGameId || !leftRail.authoritativeDiceSignature) {
      return;
    }

    const nextSnapshot = {
      value: leftRail.authoritativeDiceValue,
      signature: leftRail.authoritativeDiceSignature,
      turnNumber,
      hasChronoswarmDice: leftRail.hasChronoswarmDice,
    } as const;

    if (lastSeenAuthoritativeLeftRailDiceSignatureRef.current == null) {
      lastSeenAuthoritativeLeftRailDiceSignatureRef.current = leftRail.authoritativeDiceSignature;
      pendingAuthoritativeLeftRailDiceRef.current = null;
      releasePresentedLeftRailTurn({
        value: leftRail.authoritativeDiceValue,
        turnNumber,
        hasChronoswarmDice: leftRail.hasChronoswarmDice,
        animateMainDie: false,
      });
      return;
    }

    if (lastSeenAuthoritativeLeftRailDiceSignatureRef.current === leftRail.authoritativeDiceSignature) {
      return;
    }

    lastSeenAuthoritativeLeftRailDiceSignatureRef.current = leftRail.authoritativeDiceSignature;

    if (healthResolutionLockActive) {
      pendingAuthoritativeLeftRailDiceRef.current = nextSnapshot;
      return;
    }

    pendingAuthoritativeLeftRailDiceRef.current = null;
    releasePresentedLeftRailTurn({
      value: nextSnapshot.value,
      turnNumber: nextSnapshot.turnNumber,
      hasChronoswarmDice: nextSnapshot.hasChronoswarmDice,
      animateMainDie: true,
    });
  }, [
    effectiveGameId,
    healthResolutionLockActive,
    leftRail.authoritativeDiceSignature,
    leftRail.authoritativeDiceValue,
    leftRail.hasChronoswarmDice,
    turnNumber,
  ]);

  useLayoutEffect(() => {
    if (healthResolutionLockActive) {
      return;
    }

    const pendingSnapshot = pendingAuthoritativeLeftRailDiceRef.current;
    if (pendingSnapshot == null) {
      return;
    }

    pendingAuthoritativeLeftRailDiceRef.current = null;
    releasePresentedLeftRailTurn({
      value: pendingSnapshot.value,
      turnNumber: pendingSnapshot.turnNumber,
      hasChronoswarmDice: pendingSnapshot.hasChronoswarmDice,
      animateMainDie: true,
    });
  }, [healthResolutionLockActive]);

  useEffect(() => {
    clearTimer(phaseHoldContinuationTimerRef);

    if (!authoritativePhaseHold) {
      return;
    }

    const holdSignature = authoritativePhaseHold.signature;
    if (
      phaseHoldContinuationCompletedSignatureRef.current === holdSignature ||
      phaseHoldContinuationInFlightSignatureRef.current === holdSignature
    ) {
      return;
    }

    const delayMs = Math.max(0, authoritativePhaseHold.holdUntilMs - Date.now() + 50);
    phaseHoldContinuationTimerRef.current = setTimeout(() => {
      phaseHoldContinuationTimerRef.current = null;
      void runPhaseHoldContinuation({
        holdSignature,
        holdUntilMs: authoritativePhaseHold.holdUntilMs,
        holdTurnNumber: authoritativePhaseHold.turnNumber,
      });
    }, delayMs);

    return () => {
      clearTimer(phaseHoldContinuationTimerRef);
    };
  }, [
    authoritativePhaseHold?.holdUntilMs,
    authoritativePhaseHold?.signature,
    authoritativePhaseHold?.turnNumber,
    continueAuthoritativePhaseHold,
  ]);

  return {
    healthResolutionLockActive,
    healthResolutionOverlay,
    leftRailDiceValue: presentedLeftRailDiceValue,
    leftRailDiceAnimateKey: presentedLeftRailDiceAnimateSeq,
    leftRailTurnTakeoverTurn: presentedTurnTakeoverTurn,
    leftRailTurnTakeoverAnimateKey: presentedTurnTakeoverSeq,
    leftRailChronoswarmAnimateKey: presentedChronoswarmAnimateSeq,
  };
}
