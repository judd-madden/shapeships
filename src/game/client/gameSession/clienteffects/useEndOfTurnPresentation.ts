import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  BoardViewModel,
  BoardStatBreakdownRowVm,
  FleetAreaHealthDeltaFlashVm,
  HealthResolutionPresentationVm,
  HealthResolutionSideVm,
} from '../types';
import {
  DICE_VISUAL_ROLL_DURATION_MS,
  TURN_START_DICE_PRESENTATION_DELAY_MS,
} from './turnPhasePresentationTiming';
import {
  createTurnStartEconomyPresentationState,
  settleTurnStartEconomyPresentation,
  syncTurnStartEconomyPresentation,
  type TurnStartEconomyPresentation,
} from './turnStartPresentationGates';

export interface ContinueAuthoritativePhaseHoldArgs {
  holdSignature: string;
  holdUntilMs: number;
  holdTurnNumber: number;
}

export type ContinueAuthoritativePhaseHoldOutcome = 'released' | 'still_holding' | 'retry';

const MAX_HEALTH_FLASH_PEAK_OPACITY = 0.30;

export interface EndOfTurnHealthPresentationInput {
  boardMode: BoardViewModel['mode'];
  viewerRole: 'player' | 'spectator' | 'unknown';
  meName: string;
  opponentName: string;
  myHealth: number;
  opponentHealth: number;
  myMaxHealth: number;
  opponentMaxHealth: number;
  hasExplicitProjectedMaxHealth: boolean;
  myLastTurnNet: number;
  opponentLastTurnNet: number;
  spectatorHasTwoPlayers: boolean;
  spectatorLeftName: string;
  spectatorRightName: string;
  spectatorLeftNet: number;
  spectatorRightNet: number;
}

export interface HealthResolutionPresentationTrigger {
  signature: string;
  resolvedTurnKey: string;
  displayTurnNumber: number;
  isTerminalTurn: boolean;
  healthPresentation: EndOfTurnHealthPresentationInput;
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
  isFinished: boolean;
  isBootstrapping: boolean;
  authoritativeHoldPhaseKey: string | null;
  authoritativeHoldReason: string | null;
  authoritativeHoldUntilMs: number | null;
  healthResolutionPresentationTrigger?: HealthResolutionPresentationTrigger | null;
  healthPresentation: EndOfTurnHealthPresentationInput;
  leftRail: EndOfTurnLeftRailInput;
  economyPresentation: TurnStartEconomyPresentation<BoardStatBreakdownRowVm> | null;
  boardFlashEnabled?: boolean;
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
      nameText: subject,
      prefixText: `Take${useYouCopy ? '' : 's'} `,
      valueText: String(Math.abs(net)),
      suffixText: ' damage',
      valueTone: 'damage',
    };
  }

  if (net > 0) {
    return {
      nameText: subject,
      prefixText: `Heal${useYouCopy ? '' : 's'} `,
      valueText: String(net),
      suffixText: '',
      valueTone: 'heal',
    };
  }

  return {
    nameText: subject,
    prefixText: '',
    valueText: '\u00B10',
    suffixText: '',
    valueTone: 'neutral',
  };
}

function buildHealthResolutionPresentationSnapshot(args: {
  presentationKey: string;
  resolvedTurnNumber: number;
  displayTurnNumber: number;
  isTerminalTurn: boolean;
  healthPresentation: EndOfTurnHealthPresentationInput;
}): HealthResolutionPresentationVm | null {
  const {
    presentationKey,
    resolvedTurnNumber,
    displayTurnNumber,
    isTerminalTurn,
    healthPresentation,
  } = args;

  if (
    healthPresentation.boardMode !== 'board' ||
    !healthPresentation.hasExplicitProjectedMaxHealth
  ) {
    return null;
  }

  if (healthPresentation.viewerRole === 'player') {
    return {
      presentationKey,
      resolvedTurnNumber,
      displayTurnNumber,
      isTerminalTurn,
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
    resolvedTurnNumber,
    displayTurnNumber,
    isTerminalTurn,
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

function getHealthDeltaFlashPeakOpacity(netDelta: number): number {
  const amount = Math.min(35, Math.abs(netDelta));
  const peakOpacity =
    amount <= 0
      ? 0
      : 0.05 + ((amount - 1) / 34) * 0.95;

  if (peakOpacity <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0.05, peakOpacity));
}

function buildFleetAreaHealthDeltaFlashSnapshot(args: {
  presentationKey: string;
  health: number;
  maxHealth: number;
  netDelta: number;
}): FleetAreaHealthDeltaFlashVm | null {
  const { presentationKey, health, maxHealth, netDelta } = args;

  if (health >= maxHealth) {
    return {
      presentationKey,
      tone: 'max',
      peakOpacity: MAX_HEALTH_FLASH_PEAK_OPACITY,
    };
  }

  if (netDelta === 0) {
    return null;
  }

  return {
    presentationKey,
    tone: netDelta > 0 ? 'heal' : 'damage',
    peakOpacity: getHealthDeltaFlashPeakOpacity(netDelta),
  };
}

function buildFleetAreaHealthDeltaFlashSnapshots(args: {
  presentationKey: string;
  healthPresentation: EndOfTurnHealthPresentationInput;
}): {
  my?: FleetAreaHealthDeltaFlashVm;
  opponent?: FleetAreaHealthDeltaFlashVm;
} {
  const { presentationKey, healthPresentation } = args;

  const canShowFleetAreaFlashes =
    healthPresentation.viewerRole === 'player' ||
    (
      healthPresentation.viewerRole === 'spectator' &&
      healthPresentation.spectatorHasTwoPlayers
    );

  if (healthPresentation.boardMode !== 'board' || !canShowFleetAreaFlashes) {
    return {};
  }

  return {
    my: buildFleetAreaHealthDeltaFlashSnapshot({
      presentationKey,
      health: healthPresentation.myHealth,
      maxHealth: healthPresentation.myMaxHealth,
      netDelta: healthPresentation.myLastTurnNet,
    }) ?? undefined,
    opponent: buildFleetAreaHealthDeltaFlashSnapshot({
      presentationKey,
      health: healthPresentation.opponentHealth,
      maxHealth: healthPresentation.opponentMaxHealth,
      netDelta: healthPresentation.opponentLastTurnNet,
    }) ?? undefined,
  };
}

export function useEndOfTurnPresentation(args: UseEndOfTurnPresentationArgs) {
  const {
    effectiveGameId,
    hasMatchingAuthoritativeGameId,
    phaseKey,
    turnNumber,
    isFinished,
    isBootstrapping,
    authoritativeHoldPhaseKey,
    authoritativeHoldReason,
    authoritativeHoldUntilMs,
    healthResolutionPresentationTrigger,
    healthPresentation,
    leftRail,
    economyPresentation,
    boardFlashEnabled = true,
    continueAuthoritativePhaseHold,
  } = args;

  const phaseHoldContinuationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseHoldContinuationInFlightSignatureRef = useRef<string | null>(null);
  const phaseHoldContinuationCompletedSignatureRef = useRef<string | null>(null);
  const currentAuthoritativeHoldSignatureRef = useRef<string | null>(null);
  const healthResolutionOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnStartDicePresentationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnStartDiceSettledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenHealthResolutionOverlayHoldSignatureRef = useRef<string | null>(null);
  const lastSeenHealthResolutionTriggerSignatureRef = useRef<string | null>(null);
  const startedHealthPresentationIdentitiesRef = useRef<Set<string>>(new Set());
  const activeHealthResolutionOverlayPresentationKeyRef = useRef<string | null>(null);
  const pendingAuthoritativeLeftRailDiceRef = useRef<{
    value: 1 | 2 | 3 | 4 | 5 | 6;
    signature: string;
    turnNumber: number;
    hasChronoswarmDice: boolean;
  } | null>(null);
  const lastSeenAuthoritativeLeftRailDiceSignatureRef = useRef<string | null>(null);
  const lastPresentedLeftRailReleaseTurnRef = useRef<number | null>(null);
  const scheduledTurnStartDicePresentationRef = useRef<{
    gameId: string;
    signature: string;
    turnNumber: number;
    value: 1 | 2 | 3 | 4 | 5 | 6;
    hasChronoswarmDice: boolean;
  } | null>(null);
  const scheduledTurnStartDiceSettledRef = useRef<{
    gameId: string;
    turnNumber: number;
  } | null>(null);
  const currentGameIdRef = useRef(effectiveGameId);
  const currentTurnNumberRef = useRef(turnNumber);
  const currentFinishedRef = useRef(isFinished);

  const [healthResolutionOverlay, setHealthResolutionOverlay] =
    useState<HealthResolutionPresentationVm | undefined>(undefined);
  const [fleetAreaHealthDeltaFlashes, setFleetAreaHealthDeltaFlashes] =
    useState<{
      my?: FleetAreaHealthDeltaFlashVm;
      opponent?: FleetAreaHealthDeltaFlashVm;
    }>({});
  const [healthDeltaPresentationKey, setHealthDeltaPresentationKey] = useState<string | undefined>(undefined);
  const [presentedLeftRailDiceValue, setPresentedLeftRailDiceValue] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [presentedLeftRailDiceAnimateSeq, setPresentedLeftRailDiceAnimateSeq] = useState(0);
  const [presentedChronoswarmAnimateSeq, setPresentedChronoswarmAnimateSeq] = useState(0);
  const [presentedCubeAnimateSeq, setPresentedCubeAnimateSeq] = useState(0);
  const [presentedTurnReleaseKey, setPresentedTurnReleaseKey] = useState(0);
  const [presentedTurnReleaseTurnNumber, setPresentedTurnReleaseTurnNumber] = useState<number | null>(null);
  const [presentedTurnDiceSettledKey, setPresentedTurnDiceSettledKey] = useState(0);
  const [presentedTurnDiceSettledTurnNumber, setPresentedTurnDiceSettledTurnNumber] = useState<number | null>(null);
  const [economyPresentationState, setEconomyPresentationState] =
    useState(() => createTurnStartEconomyPresentationState({
      gameId: effectiveGameId,
      turnNumber: economyPresentation == null ? null : turnNumber,
      economy: economyPresentation,
    }));

  const healthAuthoritativePhaseHold: AuthoritativePhaseHoldVm | null =
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
  const battleRevealAuthoritativePhaseHold: AuthoritativePhaseHoldVm | null =
    effectiveGameId &&
    hasMatchingAuthoritativeGameId &&
    !isBootstrapping &&
    healthPresentation.viewerRole === 'player' &&
    phaseKey === 'battle.reveal' &&
    authoritativeHoldPhaseKey === 'battle.reveal' &&
    authoritativeHoldReason === 'battle_reveal' &&
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
  const matchupIntroAuthoritativePhaseHold: AuthoritativePhaseHoldVm | null =
    effectiveGameId &&
    hasMatchingAuthoritativeGameId &&
    !isBootstrapping &&
    healthPresentation.viewerRole === 'player' &&
    phaseKey === 'setup.species_selection' &&
    authoritativeHoldPhaseKey === 'setup.species_selection' &&
    authoritativeHoldReason === 'matchup_intro' &&
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
  const authoritativePhaseHold =
    matchupIntroAuthoritativePhaseHold ??
    healthAuthoritativePhaseHold ??
    battleRevealAuthoritativePhaseHold;

  const healthAuthoritativeHoldActive = healthAuthoritativePhaseHold != null;
  const healthResolutionLockActive = healthAuthoritativeHoldActive;
  currentGameIdRef.current = effectiveGameId;
  currentTurnNumberRef.current = turnNumber;
  currentFinishedRef.current = isFinished;
  currentAuthoritativeHoldSignatureRef.current = authoritativePhaseHold?.signature ?? null;

  function startHealthResolutionPresentation(
    presentationHealthInput: EndOfTurnHealthPresentationInput,
    resolvedTurnKey: string,
    displayTurnNumber: number,
    isTerminalTurn: boolean
  ): string | null {
    if (!effectiveGameId) {
      return null;
    }

    const resolvedTurnNumber = Number(resolvedTurnKey);
    if (!Number.isInteger(resolvedTurnNumber) || resolvedTurnNumber < 1) {
      return null;
    }

    const presentationKey = `${effectiveGameId}::health::${resolvedTurnKey}`;
    const nextOverlay = buildHealthResolutionPresentationSnapshot({
      presentationKey,
      resolvedTurnNumber,
      displayTurnNumber,
      isTerminalTurn,
      healthPresentation: presentationHealthInput,
    });

    if (nextOverlay == null) {
      return null;
    }

    const nextFleetAreaHealthDeltaFlashes = boardFlashEnabled
      ? buildFleetAreaHealthDeltaFlashSnapshots({
          presentationKey,
          healthPresentation: presentationHealthInput,
        })
      : {};

    activeHealthResolutionOverlayPresentationKeyRef.current = presentationKey;
    setHealthResolutionOverlay(nextOverlay);
    setFleetAreaHealthDeltaFlashes(nextFleetAreaHealthDeltaFlashes);
    setHealthDeltaPresentationKey(presentationKey);
    clearTimer(healthResolutionOverlayTimerRef);
    healthResolutionOverlayTimerRef.current = setTimeout(() => {
      healthResolutionOverlayTimerRef.current = null;

      if (activeHealthResolutionOverlayPresentationKeyRef.current !== presentationKey) {
        return;
      }

      activeHealthResolutionOverlayPresentationKeyRef.current = null;
      setHealthResolutionOverlay(undefined);
      setFleetAreaHealthDeltaFlashes({});
    }, 4000);

    return presentationKey;
  }

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
    clearTimer(turnStartDicePresentationTimerRef);
    clearTimer(turnStartDiceSettledTimerRef);
    setHealthResolutionOverlay(undefined);
    setFleetAreaHealthDeltaFlashes({});
    setHealthDeltaPresentationKey(undefined);
    setPresentedLeftRailDiceValue(1);
    setPresentedLeftRailDiceAnimateSeq(0);
    setPresentedChronoswarmAnimateSeq(0);
    setPresentedCubeAnimateSeq(0);
    setPresentedTurnReleaseKey(0);
    setPresentedTurnReleaseTurnNumber(null);
    setPresentedTurnDiceSettledKey(0);
    setPresentedTurnDiceSettledTurnNumber(null);
    setEconomyPresentationState(createTurnStartEconomyPresentationState({
      gameId: effectiveGameId,
      turnNumber: economyPresentation == null ? null : turnNumber,
      economy: economyPresentation,
    }));
    phaseHoldContinuationInFlightSignatureRef.current = null;
    phaseHoldContinuationCompletedSignatureRef.current = null;
    currentAuthoritativeHoldSignatureRef.current = null;
    lastSeenHealthResolutionOverlayHoldSignatureRef.current = null;
    lastSeenHealthResolutionTriggerSignatureRef.current = null;
    startedHealthPresentationIdentitiesRef.current.clear();
    activeHealthResolutionOverlayPresentationKeyRef.current = null;
    pendingAuthoritativeLeftRailDiceRef.current = null;
    lastSeenAuthoritativeLeftRailDiceSignatureRef.current = null;
    lastPresentedLeftRailReleaseTurnRef.current = null;
    scheduledTurnStartDicePresentationRef.current = null;
    scheduledTurnStartDiceSettledRef.current = null;
  }, [effectiveGameId]);

  useLayoutEffect(() => {
    setEconomyPresentationState((current) =>
      syncTurnStartEconomyPresentation(current, {
        gameId: effectiveGameId,
        turnNumber: economyPresentation == null ? null : turnNumber,
        economy: economyPresentation,
      })
    );
  }, [effectiveGameId, economyPresentation, turnNumber]);

  useEffect(() => {
    return () => {
      clearTimer(phaseHoldContinuationTimerRef);
      clearTimer(healthResolutionOverlayTimerRef);
      clearTimer(turnStartDicePresentationTimerRef);
      clearTimer(turnStartDiceSettledTimerRef);
      scheduledTurnStartDicePresentationRef.current = null;
      scheduledTurnStartDiceSettledRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!healthResolutionPresentationTrigger) {
      return;
    }

    const triggerSignature = healthResolutionPresentationTrigger.signature;
    if (lastSeenHealthResolutionTriggerSignatureRef.current === triggerSignature) {
      return;
    }

    if (!effectiveGameId) {
      return;
    }

    const resolvedTurnKey = healthResolutionPresentationTrigger.resolvedTurnKey;
    const presentationIdentity = `${effectiveGameId}::${resolvedTurnKey}`;
    if (startedHealthPresentationIdentitiesRef.current.has(presentationIdentity)) {
      lastSeenHealthResolutionTriggerSignatureRef.current = triggerSignature;
      return;
    }

    const presentationKey = startHealthResolutionPresentation(
      healthResolutionPresentationTrigger.healthPresentation,
      resolvedTurnKey,
      healthResolutionPresentationTrigger.displayTurnNumber,
      healthResolutionPresentationTrigger.isTerminalTurn
    );
    if (presentationKey == null) {
      return;
    }

    startedHealthPresentationIdentitiesRef.current.add(presentationIdentity);
    lastSeenHealthResolutionTriggerSignatureRef.current = triggerSignature;
  }, [
    healthResolutionPresentationTrigger,
    effectiveGameId,
    boardFlashEnabled,
  ]);

  useEffect(() => {
    if (!healthAuthoritativePhaseHold) {
      return;
    }

    const holdSignature = healthAuthoritativePhaseHold.signature;
    if (lastSeenHealthResolutionOverlayHoldSignatureRef.current === holdSignature) {
      return;
    }

    if (!effectiveGameId) {
      return;
    }

    const resolvedTurnKey = String(healthAuthoritativePhaseHold.turnNumber);
    const presentationIdentity = `${effectiveGameId}::${resolvedTurnKey}`;
    if (startedHealthPresentationIdentitiesRef.current.has(presentationIdentity)) {
      lastSeenHealthResolutionOverlayHoldSignatureRef.current = holdSignature;
      return;
    }

    // Current servers clear this legacy hold during end-of-turn auto-advance. If
    // an older persisted game still supplies it, the held state is a
    // pre-transition snapshot: terminal games stay on the resolved turn while
    // non-terminal games are advancing into the next turn.
    const legacyDisplayTurnNumber = isFinished
      ? healthAuthoritativePhaseHold.turnNumber
      : healthAuthoritativePhaseHold.turnNumber + 1;
    const presentationKey = startHealthResolutionPresentation(
      healthPresentation,
      resolvedTurnKey,
      legacyDisplayTurnNumber,
      isFinished
    );
    if (presentationKey == null) {
      return;
    }

    startedHealthPresentationIdentitiesRef.current.add(presentationIdentity);
    lastSeenHealthResolutionOverlayHoldSignatureRef.current = holdSignature;
  }, [
    healthAuthoritativePhaseHold?.signature,
    effectiveGameId,
    isFinished,
    healthPresentation.boardMode,
    healthPresentation.viewerRole,
    healthPresentation.meName,
    healthPresentation.opponentName,
    healthPresentation.myHealth,
    healthPresentation.opponentHealth,
    healthPresentation.myMaxHealth,
    healthPresentation.opponentMaxHealth,
    healthPresentation.hasExplicitProjectedMaxHealth,
    healthPresentation.myLastTurnNet,
    healthPresentation.opponentLastTurnNet,
    healthPresentation.spectatorHasTwoPlayers,
    healthPresentation.spectatorLeftName,
    healthPresentation.spectatorRightName,
    healthPresentation.spectatorLeftNet,
    healthPresentation.spectatorRightNet,
    boardFlashEnabled,
    turnNumber,
  ]);

  useEffect(() => {
    if (boardFlashEnabled) {
      return;
    }

    setFleetAreaHealthDeltaFlashes({});
  }, [boardFlashEnabled]);

  function releasePresentedTurn(nextTurnNumber: number): void {
    setPresentedTurnReleaseTurnNumber(nextTurnNumber);
    setPresentedTurnReleaseKey((previousKey) => previousKey + 1);
  }

  function releasePresentedTurnStartDice(args: {
    value: 1 | 2 | 3 | 4 | 5 | 6;
    hasChronoswarmDice: boolean;
    animateCubeDice: boolean;
  }): void {
    const { value, hasChronoswarmDice, animateCubeDice } = args;
    setPresentedLeftRailDiceValue(value);
    setPresentedLeftRailDiceAnimateSeq((prev) => prev + 1);
    if (hasChronoswarmDice) {
      setPresentedChronoswarmAnimateSeq((prev) => prev + 1);
    }
    if (animateCubeDice) {
      setPresentedCubeAnimateSeq((prev) => prev + 1);
    }
  }

  function schedulePresentedTurnStartDiceSettled(args: {
    gameId: string;
    turnNumber: number;
  }): void {
    clearTimer(turnStartDiceSettledTimerRef);
    const identity = { gameId: args.gameId, turnNumber: args.turnNumber };
    scheduledTurnStartDiceSettledRef.current = identity;
    turnStartDiceSettledTimerRef.current = setTimeout(() => {
      turnStartDiceSettledTimerRef.current = null;

      if (
        scheduledTurnStartDiceSettledRef.current !== identity ||
        currentGameIdRef.current !== identity.gameId ||
        currentTurnNumberRef.current !== identity.turnNumber ||
        currentFinishedRef.current
      ) {
        return;
      }

      scheduledTurnStartDiceSettledRef.current = null;
      setEconomyPresentationState((current) =>
        settleTurnStartEconomyPresentation(current, identity.turnNumber)
      );
      setPresentedTurnDiceSettledTurnNumber(identity.turnNumber);
      setPresentedTurnDiceSettledKey((previousKey) => previousKey + 1);
    }, DICE_VISUAL_ROLL_DURATION_MS);
  }

  function schedulePresentedTurnStartDice(args: {
    gameId: string;
    value: 1 | 2 | 3 | 4 | 5 | 6;
    signature: string;
    turnNumber: number;
    hasChronoswarmDice: boolean;
  }): void {
    clearTimer(turnStartDicePresentationTimerRef);
    clearTimer(turnStartDiceSettledTimerRef);
    scheduledTurnStartDiceSettledRef.current = null;
    const identity = {
      gameId: args.gameId,
      signature: args.signature,
      turnNumber: args.turnNumber,
      value: args.value,
      hasChronoswarmDice: args.hasChronoswarmDice,
    };
    scheduledTurnStartDicePresentationRef.current = identity;
    turnStartDicePresentationTimerRef.current = setTimeout(() => {
      turnStartDicePresentationTimerRef.current = null;

      if (
        scheduledTurnStartDicePresentationRef.current !== identity ||
        currentGameIdRef.current !== identity.gameId ||
        currentTurnNumberRef.current !== identity.turnNumber ||
        currentFinishedRef.current ||
        lastSeenAuthoritativeLeftRailDiceSignatureRef.current !== identity.signature
      ) {
        return;
      }

      scheduledTurnStartDicePresentationRef.current = null;
      releasePresentedTurnStartDice({
        value: identity.value,
        hasChronoswarmDice: identity.hasChronoswarmDice,
        animateCubeDice: true,
      });
      schedulePresentedTurnStartDiceSettled({
        gameId: identity.gameId,
        turnNumber: identity.turnNumber,
      });
    }, TURN_START_DICE_PRESENTATION_DELAY_MS);
  }

  function releasePresentedLeftRailTurn(args: {
    gameId: string;
    value: 1 | 2 | 3 | 4 | 5 | 6;
    signature: string;
    turnNumber: number;
    hasChronoswarmDice: boolean;
    animateMainDie: boolean;
  }): void {
    const {
      gameId,
      value,
      signature,
      turnNumber: nextTurnNumber,
      hasChronoswarmDice,
      animateMainDie,
    } = args;
    const previousPresentedTurn = lastPresentedLeftRailReleaseTurnRef.current;

    if (!animateMainDie) {
      setPresentedLeftRailDiceValue(value);
      lastPresentedLeftRailReleaseTurnRef.current = nextTurnNumber;
      return;
    }

    if (previousPresentedTurn != null && nextTurnNumber < previousPresentedTurn) {
      return;
    }

    const isLaterTurnTransition =
      previousPresentedTurn != null && nextTurnNumber > previousPresentedTurn;
    lastPresentedLeftRailReleaseTurnRef.current = nextTurnNumber;

    if (!isLaterTurnTransition || nextTurnNumber === 1) {
      releasePresentedTurnStartDice({
        value,
        hasChronoswarmDice: false,
        animateCubeDice: false,
      });
      return;
    }

    releasePresentedTurn(nextTurnNumber);
    schedulePresentedTurnStartDice({
      gameId,
      value,
      signature,
      turnNumber: nextTurnNumber,
      hasChronoswarmDice,
    });
  }

  useLayoutEffect(() => {
    if (
      !effectiveGameId ||
      !hasMatchingAuthoritativeGameId ||
      isBootstrapping ||
      isFinished ||
      !leftRail.authoritativeDiceSignature
    ) {
      clearTimer(turnStartDicePresentationTimerRef);
      clearTimer(turnStartDiceSettledTimerRef);
      scheduledTurnStartDicePresentationRef.current = null;
      scheduledTurnStartDiceSettledRef.current = null;
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
        gameId: effectiveGameId,
        value: leftRail.authoritativeDiceValue,
        signature: leftRail.authoritativeDiceSignature,
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
    const scheduledTurnStartDice = scheduledTurnStartDicePresentationRef.current;
    if (
      scheduledTurnStartDice?.gameId === effectiveGameId &&
      scheduledTurnStartDice.turnNumber === turnNumber
    ) {
      scheduledTurnStartDice.signature = nextSnapshot.signature;
      scheduledTurnStartDice.value = nextSnapshot.value;
      scheduledTurnStartDice.hasChronoswarmDice = nextSnapshot.hasChronoswarmDice;
      pendingAuthoritativeLeftRailDiceRef.current = null;
      return;
    }

    clearTimer(turnStartDicePresentationTimerRef);
    scheduledTurnStartDicePresentationRef.current = null;

    if (healthAuthoritativeHoldActive) {
      pendingAuthoritativeLeftRailDiceRef.current = nextSnapshot;
      return;
    }

    pendingAuthoritativeLeftRailDiceRef.current = null;
    releasePresentedLeftRailTurn({
      gameId: effectiveGameId,
      value: nextSnapshot.value,
      signature: nextSnapshot.signature,
      turnNumber: nextSnapshot.turnNumber,
      hasChronoswarmDice: nextSnapshot.hasChronoswarmDice,
      animateMainDie: true,
    });
  }, [
    effectiveGameId,
    hasMatchingAuthoritativeGameId,
    healthAuthoritativeHoldActive,
    isBootstrapping,
    isFinished,
    leftRail.authoritativeDiceSignature,
    leftRail.authoritativeDiceValue,
    leftRail.hasChronoswarmDice,
    turnNumber,
  ]);

  useLayoutEffect(() => {
    if (healthAuthoritativeHoldActive || !effectiveGameId || isFinished) {
      return;
    }

    const pendingSnapshot = pendingAuthoritativeLeftRailDiceRef.current;
    if (pendingSnapshot == null) {
      return;
    }

    pendingAuthoritativeLeftRailDiceRef.current = null;
    releasePresentedLeftRailTurn({
      gameId: effectiveGameId,
      value: pendingSnapshot.value,
      signature: pendingSnapshot.signature,
      turnNumber: pendingSnapshot.turnNumber,
      hasChronoswarmDice: pendingSnapshot.hasChronoswarmDice,
      animateMainDie: true,
    });
  }, [effectiveGameId, healthAuthoritativeHoldActive, isFinished]);

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
    myFleetHealthDeltaFlash: fleetAreaHealthDeltaFlashes.my,
    opponentFleetHealthDeltaFlash: fleetAreaHealthDeltaFlashes.opponent,
    healthDeltaPresentationKey,
    leftRailDiceValue: presentedLeftRailDiceValue,
    leftRailDiceAnimateKey: presentedLeftRailDiceAnimateSeq,
    leftRailChronoswarmAnimateKey: presentedChronoswarmAnimateSeq,
    leftRailCubeAnimateKey: presentedCubeAnimateSeq,
    presentedTurnReleaseKey,
    presentedTurnReleaseTurnNumber,
    presentedTurnDiceSettledKey,
    presentedTurnDiceSettledTurnNumber,
    presentedEconomy: economyPresentationState.presented,
  };
}
