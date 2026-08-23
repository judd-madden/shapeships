/**
 * INTENT REDUCER
 * 
 * Deterministic intent application with commit/reveal protocol.
 * 
 * Rules:
 * - Always use sessionPlayerId (ignore client-sent playerId)
 * - Validate player participation and role
 * - Enforce turn number matching
 * - Call syncPhaseFields after mutations
 * - Return ok/state/events or rejection
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ARCHITECTURAL BOUNDARY:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * IntentReducer handles commit/reveal enforcement and state mutation only.
 * Battle/effect resolution is triggered by phase entry via onEnterPhase → engine_shared resolvePhase.
 * Authoritative rules/effects live in engine_shared (not /game/**).
 * 
 * This reducer focuses on:
 *   ✓ Commit/reveal protocol enforcement
 *   ✓ State mutation (ships, health, resources)
 *   ✓ Phase advancement and readiness tracking
 *   ✓ Turn order and player validation
 * 
 * This reducer DOES NOT:
 *   ✗ Calculate damage/healing values
 *   ✗ Apply survivability rules
 *   ✗ Process battle phases (FirstStrike, Resolution, etc.)
 *   ✗ Interpret ship power definitions
 */

import { advancePhaseCore } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import { syncPhaseFields } from '../phase/syncPhaseFields.ts';
import { accrueClocks } from '../clock/clock.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { resolvePowerAction } from '../../engine_shared/resolve/resolvePowerAction.ts';
import { applyEffects, type EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import {
  countVerifiedCreatedShipsByTargetPlayerId,
  matchAppliedCreateShipEffectsOneToOne,
} from '../../engine_shared/effects/appliedEffectVerification.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { rollD6 } from '../util/rollD6.ts';
import { resolveBuildSubmitAuthoritatively } from './buildSubmitResolution.ts';
import {
  createBattleLogBattleCaptureEventsFromResolution,
  createBattleLogBuildCaptureEventsFromResolution,
  createBattleLogBuildCubeRollsCaptureEvent,
  createBattleLogBuildRerollCaptureEvents,
} from '../state/battleLogHistory.ts';
import {
  appendShipActivationCueBatch,
  getShipActivationSourcesFromAppliedEffects,
} from '../state/shipActivationCues.ts';
import { getCurrentDrawingPreludePlayerState } from '../state/drawingPreludeState.ts';
import {
  resolveDrawingPreludePowerAction,
  resolveDrawingPreludePowerActionsBatch,
  type DrawingPreludeResolutionResult,
} from './drawingPreludeResolution.ts';
import {
  isChargeDeclarationLegalityInvariantError,
  recordChargeDeclarationSpendAcknowledgements,
  requireChargeDeclarationLegalityState,
} from '../state/chargeDeclarationVisibility.ts';
import { debugLog } from '../../utils/serverLogger.ts';
import {
  anyPlayerIsCubeEligible,
  getCubeEligiblePlayerIds,
  getLockedCubeRollsForPlayer,
  getRepresentativeCubeInstanceId,
  playerHasValidPendingCubeChoice,
  playerIsCubeEligible,
  validateCubeDiceChoice,
} from '../phase/cubeDiceManipulation.ts';

import {
  type IntentType,
  type ComputerBotSpeciesPayload,
  type SpeciesRevealPayload,
  type SpeciesSubmitPayload,
  type BuildSubmitPayload,
  type EvolverBuildChoiceEntry,
  type ActionPayload,
  type ActionsBatchPayload,
  type ChargeDeclarationSubmitPayload,
  RejectionCode,
  getSpeciesCommitKey,
  getBuildCommitKey,
} from './IntentTypes.ts';
import { ancientAtomicDeclarationContractApplies } from './chargeDeclarationEligibility.ts';
import { resolveChargeDeclarationSubmission } from './chargeDeclarationResolution.ts';
import {
  storeCommit,
  storeReveal,
  hasCommitted,
  hasRevealed,
} from './CommitStore.ts';
import type { ShipActivationCueSource } from '../state/GameStateTypes.ts';
import {
  chooseDeterministicCentaurBotPlanId,
  getCentaurBotPlanById,
} from '../bot/centaurPlans.ts';
import {
  chooseDeterministicHumanBotPlanId,
  getHumanBotPlanById,
} from '../bot/humanPlans.ts';
import {
  chooseDeterministicXeniteBotPlanId,
  getXeniteBotPlanById,
} from '../bot/xenitePlans.ts';
import type { BotSpeciesId } from '../bot/botTypes.ts';
import {
  ensureMissionChallengeAssignment,
  MISSION_INTRO_GATE_ENABLED,
} from '../mission/MissionChallenge.ts';

export const MATCHUP_INTRO_DURATION_MS = 3300;

export interface IntentRequest {
  gameId: string;
  intentType: IntentType;
  turnNumber: number;
  
  // Commit fields
  commitHash?: string;
  
  // Reveal fields
  payload?: any;
  nonce?: string;
}

export interface IntentResult {
  ok: boolean;
  state: any;
  events: any[];
  rejected?: {
    code: string;
    message: string;
  };
}

function toIntentResultFromDrawingPrelude(
  result: DrawingPreludeResolutionResult,
): IntentResult {
  if (result.ok) {
    return { ok: true, state: result.state, events: result.events };
  }
  return {
    ok: false,
    state: result.state,
    events: [],
    rejected: {
      code: result.error.kind === 'invariant'
        ? RejectionCode.INTERNAL_ERROR
        : result.error.kind === 'unsupported'
        ? RejectionCode.DRAWING_PRELUDE_UNSUPPORTED
        : RejectionCode.BAD_PAYLOAD,
      message: result.error.message,
    },
  };
}

type KnoRerollPassIndex = 1 | 2 | 3;

function isFinishedGameChatMessageIntent(intent: IntentRequest): boolean {
  if (intent.intentType !== 'ACTION') return false;

  const payload = intent.payload;
  return !!payload && typeof payload === 'object' && payload.actionType === 'message';
}

function isPhaseHoldContinuationIntent(intent: IntentRequest): boolean {
  return intent.intentType === 'CONTINUE_PHASE_HOLD';
}

function isAllowedWhileMissionIntroPending(intent: IntentRequest): boolean {
  if (
    intent.intentType === 'MISSION_INTRO_ACK' ||
    intent.intentType === 'SURRENDER' ||
    intent.intentType === 'CONTINUE_PHASE_HOLD'
  ) {
    return true;
  }

  return intent.intentType === 'ACTION' && intent.payload?.actionType === 'message';
}

function getCurrentPhaseHold(state: any) {
  const phaseHold = state?.gameData?.turnData?.phaseHold;
  return phaseHold && typeof phaseHold === 'object' ? phaseHold : null;
}

function isSupportedPhaseHoldReason(
  holdReason: unknown,
): holdReason is 'end_of_turn_health' | 'battle_reveal' | 'matchup_intro' {
  return holdReason === 'end_of_turn_health' ||
    holdReason === 'battle_reveal' ||
    holdReason === 'matchup_intro';
}

function isCurrentMatchupIntroHold(state: any): boolean {
  const phaseHold = getCurrentPhaseHold(state);
  return getPhaseKey(state) === 'setup.species_selection' &&
    phaseHold?.phaseKey === 'setup.species_selection' &&
    phaseHold?.holdReason === 'matchup_intro';
}

function isAllowedWhileMatchupIntroHeld(
  state: any,
  playerId: string,
  intent: IntentRequest,
): boolean {
  if (intent.intentType === 'CONTINUE_PHASE_HOLD' || intent.intentType === 'SURRENDER') {
    return true;
  }

  if (intent.intentType === 'ACTION') {
    return intent.payload?.actionType === 'message';
  }

  if (intent.intentType === 'SPECIES_SUBMIT') {
    const player = state?.players?.find((candidate: any) => candidate?.id === playerId);
    return player?.faction != null && intent.payload?.species === player.faction;
  }

  return false;
}

function hasCompletedSpeciesSelection(state: any): boolean {
  const activePlayers = Array.isArray(state?.players)
    ? state.players.filter((player: any) => player?.role === 'player')
    : [];

  return activePlayers.length === 2 &&
    activePlayers.every((player: any) => player?.faction != null);
}

function releaseCompletedSpeciesSelectionSetup(
  state: any,
  nowMs: number,
  events: any[],
): IntentResult {
  const fromKey = getPhaseKey(state);

  if (fromKey !== 'setup.species_selection' || !hasCompletedSpeciesSelection(state)) {
    events.push({
      type: 'PHASE_ADVANCE_BLOCKED',
      from: fromKey,
      reason: 'Species selection setup is not complete',
      atMs: nowMs,
    });

    return {
      ok: true,
      state: syncPhaseFields(state),
      events,
    };
  }

  const advanceResult = advancePhaseCore(state, nowMs);

  if (!advanceResult.ok) {
    events.push({
      type: 'PHASE_ADVANCE_BLOCKED',
      from: fromKey,
      reason: advanceResult.error,
      atMs: nowMs,
    });

    return {
      ok: true,
      state: syncPhaseFields(state),
      events,
    };
  }

  state = advanceResult.state;
  state.gameData.phaseReadiness = [];
  events.push(...advanceResult.events);
  state = syncPhaseFields(state);

  const toKey = getPhaseKey(state);

  events.push({
    type: 'PHASE_ADVANCED',
    from: fromKey,
    to: toKey,
    atMs: nowMs,
  });

  if (toKey) {
    const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
    state = onEnterResult.state;
    events.push(...onEnterResult.events);
  }

  return {
    ok: true,
    state: syncPhaseFields(state),
    events,
  };
}

function getEffectEventsFromOutcomeEvents(events: any[] | undefined): EffectEvent[] {
  if (!Array.isArray(events)) return [];
  return events.filter((event: any): event is EffectEvent => event?.type === 'EFFECT_APPLIED');
}

function incrementShipsMadeThisTurnCounter(
  state: any,
  playerId: string,
  amount: number
) {
  if (!Number.isInteger(amount) || amount <= 0) return;

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const currentMap = state.gameData.turnData.shipsMadeThisTurnByPlayerId || {};
  const currentCount = currentMap[playerId] || 0;

  state.gameData.turnData.shipsMadeThisTurnByPlayerId = {
    ...currentMap,
    [playerId]: currentCount + amount,
  };
}

function countFleetShipsByDefId(state: any, playerId: string, shipDefId: string): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  let count = 0;
  for (const ship of fleet) {
    if (ship?.shipDefId === shipDefId) count++;
  }
  return count;
}

function isEvolvedXeniteShipDefId(shipDefId: string): boolean {
  return shipDefId === 'OXI' || shipDefId === 'AST';
}

function clearPendingDrawOfferState(state: any) {
  if (!state.gameData) state.gameData = {};
  state.gameData.pendingDrawOffer = null;

  if ('drawAgreement' in state.gameData) {
    state.gameData.drawAgreement = null;
  }
}

function getLegacyCompatiblePendingDrawOffer(state: any) {
  const pendingDrawOffer = state?.gameData?.pendingDrawOffer;
  if (
    pendingDrawOffer &&
    typeof pendingDrawOffer.offererPlayerId === 'string' &&
    typeof pendingDrawOffer.offereePlayerId === 'string'
  ) {
    return pendingDrawOffer;
  }

  const offeredBy = state?.gameData?.drawAgreement?.offeredBy;
  if (typeof offeredBy !== 'string' || offeredBy.length === 0) {
    return null;
  }

  const activePlayers = Array.isArray(state?.players)
    ? state.players.filter((player: any) => player?.role === 'player')
    : [];
  const offeree = activePlayers.find((player: any) => player?.id !== offeredBy);

  if (!offeree?.id) {
    return null;
  }

  return {
    offererPlayerId: offeredBy,
    offereePlayerId: offeree.id,
    offeredTurnNumber: state?.gameData?.turnNumber ?? state?.turnNumber ?? 0,
  };
}

function finishGameWithCanonicalResult(args: {
  state: any;
  result: 'win' | 'draw';
  winnerPlayerId: string | null;
  resultReason: 'resignation' | 'agreement';
  nowMs: number;
  events: any[];
}): IntentResult {
  const { state, result, winnerPlayerId, resultReason, nowMs, events } = args;

  state.status = 'finished';
  state.winnerPlayerId = winnerPlayerId;
  state.result = result;
  state.resultReason = resultReason;
  clearPendingDrawOfferState(state);

  events.push({
    type: 'GAME_OVER',
    result,
    resultReason,
    winnerPlayerId,
    atMs: nowMs,
  });

  const syncedState = syncPhaseFields(state);

  return {
    ok: true,
    state: syncedState,
    events,
  };
}

function getKnoRerollPassIndex(state: any): KnoRerollPassIndex {
  const passIndex = state?.gameData?.turnData?.knoRerollPassIndex;
  return passIndex === 2 || passIndex === 3 ? passIndex : 1;
}

function getKnoCountForPlayer(state: any, playerId: string): number {
  return countFleetShipsByDefId(state, playerId, 'KNO');
}

function getKnoMaxRerollPassCountForPlayer(state: any, playerId: string): KnoRerollPassIndex | 0 {
  return Math.min(3, getKnoCountForPlayer(state, playerId)) as KnoRerollPassIndex | 0;
}

function getMaxKnoRerollPassCountForGame(state: any): KnoRerollPassIndex | 0 {
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  let maxPassCount = 0;

  for (const player of activePlayers) {
    maxPassCount = Math.max(maxPassCount, getKnoMaxRerollPassCountForPlayer(state, player.id));
  }

  return maxPassCount as KnoRerollPassIndex | 0;
}

function playerHasKnoRerollForPass(state: any, playerId: string, passIndex: KnoRerollPassIndex): boolean {
  return getKnoMaxRerollPassCountForPlayer(state, playerId) >= passIndex;
}

function playerIsKnoRerollStopped(state: any, playerId: string): boolean {
  return state?.gameData?.turnData?.knoRerollStoppedByPlayerId?.[playerId] === true;
}

function playerCanActInKnoRerollPass(state: any, playerId: string, passIndex: KnoRerollPassIndex): boolean {
  return playerHasKnoRerollForPass(state, playerId, passIndex) && !playerIsKnoRerollStopped(state, playerId);
}

function gameHasEligibleKnoActorsForPass(state: any, passIndex: KnoRerollPassIndex): boolean {
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) => playerCanActInKnoRerollPass(state, player.id, passIndex));
}

function getNextEligibleKnoRerollPassIndex(
  state: any,
  passIndex: KnoRerollPassIndex
): KnoRerollPassIndex | null {
  const maxPassCount = getMaxKnoRerollPassCountForGame(state);

  for (let nextPassIndex = passIndex + 1; nextPassIndex <= maxPassCount; nextPassIndex++) {
    if (gameHasEligibleKnoActorsForPass(state, nextPassIndex as KnoRerollPassIndex)) {
      return nextPassIndex as KnoRerollPassIndex;
    }
  }

  return null;
}

function getRepresentativeKnoInstanceIdForPass(
  state: any,
  playerId: string,
  passIndex: KnoRerollPassIndex
): string | null {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  const knoInstanceIds = Array.isArray(fleet)
    ? fleet
      .filter((ship: any) => ship?.shipDefId === 'KNO' && typeof ship?.instanceId === 'string')
      .map((ship: any) => ship.instanceId)
      .sort((a: string, b: string) => a.localeCompare(b))
    : [];

  if (knoInstanceIds.length === 0) return null;
  return knoInstanceIds[passIndex - 1] ?? knoInstanceIds[0];
}

function recomputeDiceReadState(state: any, baseDice: number) {
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  const effectiveByPlayerId: Record<string, number> = {};
  const overrideSourceByPlayerId: Record<string, string> = {};

  for (const player of activePlayers) {
    const fleet = state?.gameData?.ships?.[player.id] ?? [];
    const hasLeviathan = Array.isArray(fleet) && fleet.some((ship: any) => ship?.shipDefId === 'LEV');

    if (hasLeviathan) {
      effectiveByPlayerId[player.id] = 6;
      overrideSourceByPlayerId[player.id] = 'LEV';
    } else {
      effectiveByPlayerId[player.id] = baseDice;
    }
  }

  return { effectiveByPlayerId, overrideSourceByPlayerId };
}

function stageKnoRerollChoice(
  state: any,
  playerId: string,
  sourceInstanceId: string,
  actionId: string,
  choiceId: string
) {
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'build.dice_roll') {
    throw new Error('WRONG_PHASE');
  }
  if (state?.gameData?.turnData?.diceManipulationStage !== 'kno') {
    throw new Error('INVALID_KNO_STAGE');
  }
  if (actionId !== 'KNO#0') {
    throw new Error('INVALID_KNO_ACTION');
  }
  if (choiceId !== 'reroll' && choiceId !== 'hold') {
    throw new Error('INVALID_KNO_CHOICE');
  }

  const passIndex = getKnoRerollPassIndex(state);
  if (!playerCanActInKnoRerollPass(state, playerId, passIndex)) {
    throw new Error('KNO_REROLL_NOT_AVAILABLE');
  }

  const representativeSourceInstanceId = getRepresentativeKnoInstanceIdForPass(state, playerId, passIndex);
  if (!representativeSourceInstanceId || representativeSourceInstanceId !== sourceInstanceId) {
    throw new Error('INVALID_KNO_SOURCE');
  }

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const pendingByPlayerId = state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId || {};
  const playerPending = pendingByPlayerId[playerId] || {};
  state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId = {
    ...pendingByPlayerId,
    [playerId]: {
      ...playerPending,
      [passIndex]: choiceId,
    },
  };

  if (choiceId === 'hold') {
    state.gameData.turnData.knoRerollStoppedByPlayerId = {
      ...(state.gameData.turnData.knoRerollStoppedByPlayerId || {}),
      [playerId]: true,
    };
  }
}

function stageCubeDiceChoice(
  state: any,
  playerId: string,
  sourceInstanceId: string,
  actionId: string,
  choiceId: string,
) {
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'build.dice_roll') throw new Error('WRONG_PHASE');

  const validated = validateCubeDiceChoice(
    state,
    playerId,
    sourceInstanceId,
    actionId,
    choiceId,
  );

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};
  state.gameData.turnData.pendingCubeDiceChoiceByPlayerId = {
    ...(state.gameData.turnData.pendingCubeDiceChoiceByPlayerId || {}),
    [playerId]: validated.choiceId,
  };
}

function clearResolvedKnoPassChoices(state: any, passIndex: KnoRerollPassIndex) {
  const pendingByPlayerId = state?.gameData?.turnData?.pendingKnoRerollChoiceByPassByPlayerId;
  if (!pendingByPlayerId) return;

  const nextPendingByPlayerId: Record<string, Partial<Record<KnoRerollPassIndex, 'reroll' | 'hold'>>> = {};
  for (const [playerId, choicesByPass] of Object.entries(pendingByPlayerId)) {
    const nextChoicesByPass = { ...(choicesByPass as Partial<Record<KnoRerollPassIndex, 'reroll' | 'hold'>>) };
    delete nextChoicesByPass[passIndex];
    if (Object.keys(nextChoicesByPass).length > 0) {
      nextPendingByPlayerId[playerId] = nextChoicesByPass;
    }
  }

  state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId = nextPendingByPlayerId;
}

function resolvePendingKnoRerollPass(state: any, nowMs: number, events: any[]) {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const turnData = state.gameData.turnData;
  const passIndex = getKnoRerollPassIndex(state);
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const eligiblePlayerIds = activePlayers
    .map((player: any) => player.id)
    .filter((currentPlayerId: string) => playerCanActInKnoRerollPass(state, currentPlayerId, passIndex));
  const nextEligiblePassIndex = getNextEligibleKnoRerollPassIndex(state, passIndex);

  if (eligiblePlayerIds.length === 0) {
    const cubeFollows = nextEligiblePassIndex == null && anyPlayerIsCubeEligible(state);
    turnData.diceFinalized = false;
    if (nextEligiblePassIndex == null && !cubeFollows) {
      delete turnData.diceManipulationStage;
      delete turnData.knoRerollPassIndex;
      turnData.pendingKnoRerollChoiceByPassByPlayerId = {};
      turnData.knoRerollStoppedByPlayerId = {};
      turnData.diceFinalized = true;
    }
    return state;
  }

  const pendingByPlayerId = turnData.pendingKnoRerollChoiceByPassByPlayerId || {};
  const rerollingPlayerIds = eligiblePlayerIds.filter((currentPlayerId: string) => {
    const playerChoices = pendingByPlayerId[currentPlayerId] || {};
    return playerChoices[passIndex] === 'reroll';
  });
  const anyReroll = eligiblePlayerIds.some((currentPlayerId: string) => {
    const playerChoices = pendingByPlayerId[currentPlayerId] || {};
    return playerChoices[passIndex] === 'reroll';
  });

  if (anyReroll) {
    const baseValueBeforeReroll = turnData.baseDiceRoll ?? turnData.effectiveDiceRoll ?? turnData.diceRoll ?? 0;
    const nextBaseDice = rollD6();
    const { effectiveByPlayerId, overrideSourceByPlayerId } = recomputeDiceReadState(state, nextBaseDice);

    turnData.baseDiceRoll = nextBaseDice;
    turnData.effectiveDiceRoll = nextBaseDice;
    turnData.diceRoll = nextBaseDice;
    turnData.diceRolled = true;
    turnData.effectiveDiceRollByPlayerId = effectiveByPlayerId;
    if (Object.keys(overrideSourceByPlayerId).length > 0) {
      turnData.diceOverrideSourceByPlayerId = overrideSourceByPlayerId;
    } else {
      delete turnData.diceOverrideSourceByPlayerId;
    }
    state.gameData.diceRoll = nextBaseDice;

    events.push({
      type: 'DICE_ROLLED',
      value: nextBaseDice,
      turnNumber: state.gameData.turnNumber || 1,
      atMs: nowMs
    });
    events.push(
      ...createBattleLogBuildRerollCaptureEvents({
        turnNumber: state.gameData.turnNumber || 1,
        baseValueBeforeReroll,
        rerollingPlayerIds,
        newValue: nextBaseDice,
      }),
    );
  }

  clearResolvedKnoPassChoices(state, passIndex);
  const cubeFollows = nextEligiblePassIndex == null && anyPlayerIsCubeEligible(state);
  turnData.diceFinalized = false;
  if (nextEligiblePassIndex == null && !cubeFollows) {
    delete turnData.diceManipulationStage;
    delete turnData.knoRerollPassIndex;
    turnData.pendingKnoRerollChoiceByPassByPlayerId = {};
    turnData.knoRerollStoppedByPlayerId = {};
    turnData.diceFinalized = true;
  }

  if (!anyReroll) {
    return state;
  }

  return appendShipActivationCueBatch(state, {
    key: `ship-activation:${
      state.gameData?.turnData?.turnNumber ??
      state.gameData?.turnNumber ??
      state.turnNumber ??
      0
    }:build.dice_roll:kno-pass:${passIndex}`,
    phaseKey: 'build.dice_roll',
    sources: rerollingPlayerIds.flatMap((rerollingPlayerId: string) => {
      const sourceInstanceId = getRepresentativeKnoInstanceIdForPass(
        state,
        rerollingPlayerId,
        passIndex
      );
      return sourceInstanceId
        ? [{ playerId: rerollingPlayerId, sourceInstanceId }]
        : [];
    }),
  });
}

function resolvePendingCubeDiceChoices(state: any, nowMs: number, events: any[]) {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const turnData = state.gameData.turnData;
  const eligiblePlayerIds = getCubeEligiblePlayerIds(state);
  const pendingByPlayerId = turnData.pendingCubeDiceChoiceByPlayerId || {};
  const selections = {
    ...(turnData.cubeDiceSelectionByPlayerId || {}),
  };
  const effectiveByPlayerId = {
    ...(turnData.effectiveDiceRollByPlayerId || {}),
  };
  const overrideByPlayerId = {
    ...(turnData.diceOverrideSourceByPlayerId || {}),
  };
  const visibleByPlayerId = {
    ...(turnData.visibleCubeDiceValueByPlayerId || {}),
  };
  for (const currentPlayerId of eligiblePlayerIds) {
    const sourceInstanceId = getRepresentativeCubeInstanceId(state, currentPlayerId);
    const choiceId = pendingByPlayerId[currentPlayerId];
    if (!sourceInstanceId || typeof choiceId !== 'string') {
      throw new Error('MISSING_CUBE_DICE_CHOICE');
    }

    const selection = validateCubeDiceChoice(
      state,
      currentPlayerId,
      sourceInstanceId,
      'CUB#0',
      choiceId,
    );

    effectiveByPlayerId[currentPlayerId] = selection.value;
    selections[currentPlayerId] = selection;

    if (selection.sourceInstanceId) {
      overrideByPlayerId[currentPlayerId] = 'CUB';
      visibleByPlayerId[currentPlayerId] = selection.value;
    } else if (overrideByPlayerId[currentPlayerId] === 'CUB') {
      delete overrideByPlayerId[currentPlayerId];
    }

    const cubeRollValues = getLockedCubeRollsForPlayer(state, currentPlayerId)
      .map((roll) => roll.value);
    events.push(createBattleLogBuildCubeRollsCaptureEvent({
      turnNumber: state.gameData.turnNumber || 1,
      playerId: currentPlayerId,
      cubeRollValues,
    }));

    events.push({
      type: 'CUBE_DICE_CHOSEN',
      playerId: currentPlayerId,
      choiceId: selection.choiceId,
      selectedValue: selection.value,
      ...(selection.sourceInstanceId
        ? { sourceInstanceId: selection.sourceInstanceId }
        : {}),
      atMs: nowMs,
    });
  }

  turnData.effectiveDiceRollByPlayerId = effectiveByPlayerId;
  turnData.cubeDiceSelectionByPlayerId = selections;
  turnData.visibleCubeDiceValueByPlayerId = visibleByPlayerId;
  turnData.pendingCubeDiceChoiceByPlayerId = {};
  if (Object.keys(overrideByPlayerId).length > 0) {
    turnData.diceOverrideSourceByPlayerId = overrideByPlayerId;
  } else {
    delete turnData.diceOverrideSourceByPlayerId;
  }
  delete turnData.diceManipulationStage;
  turnData.diceFinalized = true;
  return state;
}

function validateEvolverChoicesPayload(
  payload: BuildSubmitPayload,
  totalEvolverCount: number,
  totalXenCount: number
): { ok: true; choices: EvolverBuildChoiceEntry[] } | { ok: false; message: string } {
  if (payload.evolverChoices === undefined) {
    return { ok: true, choices: [] };
  }

  if (!Array.isArray(payload.evolverChoices)) {
    return { ok: false, message: 'Invalid build payload: evolverChoices must be an array' };
  }

  if (payload.evolverChoices.length > totalEvolverCount) {
    return {
      ok: false,
      message: `Invalid evolverChoices length: expected at most ${totalEvolverCount}, got ${payload.evolverChoices.length}`,
    };
  }

  const seenSourceKeys = new Set<string>();
  let nonHoldCount = 0;

  for (const entry of payload.evolverChoices) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, message: 'Invalid evolverChoices entry: expected object' };
    }

    if (typeof entry.sourceKey !== 'string' || entry.sourceKey.trim() === '') {
      return { ok: false, message: 'Invalid evolverChoices entry: sourceKey must be a non-empty string' };
    }

    if (seenSourceKeys.has(entry.sourceKey)) {
      return { ok: false, message: `Duplicate evolverChoices sourceKey: ${entry.sourceKey}` };
    }
    seenSourceKeys.add(entry.sourceKey);

    if (entry.choiceId !== 'hold' && entry.choiceId !== 'oxite' && entry.choiceId !== 'asterite') {
      return {
        ok: false,
        message: `Invalid evolver choiceId: ${String((entry as any).choiceId)}. Must be hold, oxite, or asterite.`,
      };
    }

    if (entry.choiceId !== 'hold') {
      nonHoldCount++;
    }
  }

  if (nonHoldCount > totalXenCount) {
    return {
      ok: false,
      message: `Invalid evolverChoices: requested ${nonHoldCount} conversions but only ${totalXenCount} Xenite(s) are available.`,
    };
  }

  return { ok: true, choices: payload.evolverChoices };
}

function validateSelectedNumberArray(args: {
  raw: unknown;
  expectedCount: number;
  fieldName: string;
  required: boolean;
}): { ok: true } | { ok: false; message: string } {
  const { raw, expectedCount, fieldName, required } = args;
  if (typeof raw === 'undefined') {
    return required
      ? { ok: false, message: `Invalid build payload: ${fieldName} is required` }
      : { ok: true };
  }

  if (!Array.isArray(raw)) {
    return { ok: false, message: `Invalid build payload: ${fieldName} must be an array` };
  }

  if (raw.length !== expectedCount) {
    return {
      ok: false,
      message: `Invalid ${fieldName} length: expected ${expectedCount}, got ${raw.length}`,
    };
  }

  for (const selectedNumber of raw) {
    if (!Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > 6) {
      return {
        ok: false,
        message: `Invalid ${fieldName} entry: ${selectedNumber}. Must be integer 1..6`,
      };
    }
  }

  return { ok: true };
}

/**
 * Apply an intent to game state.
 * 
 * @param state - Current game state
 * @param sessionPlayerId - Authenticated player ID (from session)
 * @param intent - Intent request
 * @param nowMs - Current timestamp
 * @returns Result with updated state, events, or rejection
 */
export async function applyIntent(
  state: any,
  sessionPlayerId: string,
  intent: IntentRequest,
  nowMs: number
): Promise<IntentResult> {
  const events: any[] = [];

  if (!state) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.GAME_FINISHED,
        message: 'Game is finished'
      }
    };
  }

  if (!state.gameData) state.gameData = {};
  
  // Accrue server-authoritative clocks before applying intent (authoritative timekeeping)
  state = accrueClocks(state, nowMs);
  
  // ============================================================================
  // VALIDATION: Game state
  // ============================================================================
  
  if (
    state.status === 'finished' &&
    !isFinishedGameChatMessageIntent(intent) &&
    !isPhaseHoldContinuationIntent(intent)
  ) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.GAME_FINISHED,
        message: 'Game is finished'
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Player participation
  // ============================================================================
  
  const player = state.players?.find((p: any) => p.id === sessionPlayerId);
  
  if (!player) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.NOT_PARTICIPANT,
        message: 'Player is not a participant in this game'
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Active player guard (PART A - MANDATORY)
  // ============================================================================
  
  // Player-authored intents require active player status
  const playerAuthoredIntents = new Set([
    'SPECIES_SUBMIT',
    'SPECIES_COMMIT',
    'SPECIES_REVEAL',
    'BUILD_SUBMIT',
    'CHARGE_DECLARATION_SUBMIT',
    'DECLARE_READY',
    'ACTION',
    'ACTIONS_SUBMIT'
  ]);
  
  if (playerAuthoredIntents.has(intent.intentType)) {
    // Authorization is based on membership/role, not presence.
    // "isActive" is a presence/UI signal and should not wedge gameplay on refresh/reconnect.
    if (player.role !== 'player') {
      console.warn('[IntentReducer] PLAYER_NOT_ACTIVE rejection:', {
        gameId: intent.gameId,
        intentType: intent.intentType,
        sessionId: sessionPlayerId,
        role: player.role,
        isActive: player.isActive,
        reason: 'PLAYER_NOT_ACTIVE'
      });
      
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.PLAYER_NOT_ACTIVE,
          message: 'Player is not an active participant in this game'
        }
      };
    }
  }

  if (
    isCurrentMatchupIntroHold(state) &&
    !isAllowedWhileMatchupIntroHeld(state, sessionPlayerId, intent)
  ) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.PHASE_NOT_ALLOWED,
        message: 'Only matchup continuation, chat, surrender, or an idempotent species retry is allowed during the matchup intro',
      },
    };
  }

  const missionAssignment = state.missionChallengeAssignment;
  const isAssignedPendingHuman =
    MISSION_INTRO_GATE_ENABLED &&
    missionAssignment?.introPending === true &&
    missionAssignment?.playerId === sessionPlayerId &&
    state.controllersByPlayerId?.[sessionPlayerId]?.kind === 'human';

  if (isAssignedPendingHuman && !isAllowedWhileMissionIntroPending(intent)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.MISSION_INTRO_PENDING,
        message: 'Acknowledge the Mission intro before submitting gameplay',
      },
    };
  }

  if (intent.intentType === 'CONTINUE_PHASE_HOLD' && player.role === 'spectator') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot continue authoritative phase holds'
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Turn number
  // ============================================================================
  
  const currentTurn = state.gameData?.turnNumber ?? 0;

  // BUILD_SUBMIT is allowed to arrive with a stale client turn due to polling drift.
  // Server is authoritative: normalize to currentTurn before routing.
  if (intent.intentType === 'BUILD_SUBMIT' && intent.turnNumber !== currentTurn) {
    console.warn('[IntentReducer] Normalizing BUILD_SUBMIT turnNumber', {
      provided: intent.turnNumber,
      canonical: currentTurn,
    });
    intent = { ...intent, turnNumber: currentTurn };
  }
  
  if (intent.intentType !== 'CONTINUE_PHASE_HOLD' && intent.turnNumber !== currentTurn) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_TURN,
        message: `Expected turn ${currentTurn}, got ${intent.turnNumber}`
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Phase-based intent gating
  // ============================================================================
  
  // Compute current phase key
  const phaseKey = 
    state.phaseKey ??
    (state.gameData?.currentPhase && state.gameData?.currentSubPhase
      ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
      : null);
  
  // Enforce species selection phase restriction
  if (phaseKey === 'setup.species_selection') {
    const allowedInSpeciesSelection = new Set([
      'SPECIES_SUBMIT',
      'MISSION_INTRO_ACK',
      'CONTINUE_PHASE_HOLD',
      'ACTION',        // ✅ allow chat at all times
      'SURRENDER',   // optional, if you want resign to work during setup
    ]);
  
    if (!allowedInSpeciesSelection.has(intent.intentType)) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.PHASE_NOT_ALLOWED,
          message: `Intent ${intent.intentType} not allowed during setup.species_selection. Allowed: SPECIES_SUBMIT, MISSION_INTRO_ACK, CONTINUE_PHASE_HOLD, ACTION, SURRENDER`
        }
      };
    }
  }
  
  if (
    phaseKey === 'battle.charge_declaration' &&
    ancientAtomicDeclarationContractApplies(state, sessionPlayerId)
  ) {
    const isPowerAction = intent.intentType === 'ACTION' && intent.payload?.actionType === 'power';
    if (
      isPowerAction ||
      intent.intentType === 'ACTIONS_SUBMIT' ||
      intent.intentType === 'DECLARE_READY'
    ) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.PHASE_NOT_ALLOWED,
          message: 'Ancient Charge Declaration input must use CHARGE_DECLARATION_SUBMIT',
        },
      };
    }
  }

  // ============================================================================
  // ROUTE BY INTENT TYPE
  // ============================================================================
  
  switch (intent.intentType) {
    case 'SPECIES_SUBMIT':
      return await handleSpeciesSubmit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'SPECIES_COMMIT':
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DEPRECATED_INTENT,
          message: 'SPECIES_COMMIT is deprecated. Use SPECIES_SUBMIT instead.'
        }
      };
      
    case 'SPECIES_REVEAL':
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DEPRECATED_INTENT,
          message: 'SPECIES_REVEAL is deprecated. Use SPECIES_SUBMIT instead.'
        }
      };
      
    case 'BUILD_SUBMIT':
      return await handleBuildSubmit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'CHARGE_DECLARATION_SUBMIT':
      return handleChargeDeclarationSubmit(state, sessionPlayerId, intent, nowMs, events);

    case 'DECLARE_READY':
      return handleDeclareReady(state, sessionPlayerId, intent, nowMs, events);

    case 'MISSION_INTRO_ACK':
      return handleMissionIntroAck(state, sessionPlayerId, nowMs, events);

    case 'CONTINUE_PHASE_HOLD':
      return handleContinuePhaseHold(state, sessionPlayerId, intent, nowMs, events);
      
    case 'ACTION':
      return handleAction(state, sessionPlayerId, intent, nowMs, events);
      
    case 'ACTIONS_SUBMIT':
      return handleActionsSubmit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'SURRENDER':
      return handleSurrender(state, sessionPlayerId, intent, nowMs, events);
      
    case 'DRAW_OFFER':
      return handleDrawOffer(state, sessionPlayerId, intent, nowMs, events);
      
    case 'DRAW_ACCEPT':
      return handleDrawAccept(state, sessionPlayerId, intent, nowMs, events);

    case 'DRAW_REFUSE':
      return handleDrawRefuse(state, sessionPlayerId, intent, nowMs, events);
      
    default:
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Unknown intent type: ${intent.intentType}`
        }
      };
  }
}

// ============================================================================
// SPECIES_SELECT (Atomic species selection - no separate commit/reveal)
// ============================================================================

async function handleSpeciesSelect(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can select species
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot select species'
      }
    };
  }
  
  // Must be in setup.species_selection phase
  const currentPhase = state.gameData?.currentPhase ?? state.currentPhase;
  const currentSubPhase = state.gameData?.currentSubPhase ?? state.currentSubPhase;
  
  if (currentPhase !== 'setup' || currentSubPhase !== 'species_selection') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.PHASE_NOT_ALLOWED,
        message: 'Can only select species during setup.species_selection phase'
      }
    };
  }
  
  // Check if player already selected species
  if (player.faction) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Species already selected'
      }
    };
  }
  
  // Validate payload
  if (!intent.payload || typeof intent.payload !== 'object') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload'
      }
    };
  }
  
  const payload = intent.payload as { species: string };
  const validSpecies = ['human', 'xenite', 'centaur', 'ancient'];
  
  if (!payload.species || !validSpecies.includes(payload.species)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.INVALID_SPECIES,
        message: `Invalid species: ${payload.species}`
      }
    };
  }
  
  // Store species selection
  player.faction = payload.species;
  
  events.push({
    type: 'SPECIES_SELECTED',
    playerId,
    species: payload.species,
    atMs: nowMs
  });
  
  // Check if all players have selected species
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const allSelected = activePlayers.every((p: any) => !!p.faction);
  
  if (allSelected) {
    debugLog('[SPECIES_SELECT] All players have selected species, auto-advancing...');
    
    const fromKey = state.phaseKey ?? 
      (state.gameData?.currentPhase && state.gameData?.currentSubPhase
        ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
        : 'UNKNOWN');
    
    // Advance phase using core (system-driven) advancement
    const advanceResult = advancePhaseCore(state);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      state = syncPhaseFields(state);
      
      const toKey = state.phaseKey ?? 
        (state.gameData?.currentPhase && state.gameData?.currentSubPhase
          ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
          : 'UNKNOWN');
      
      debugLog('[SPECIES_SELECT] Phase advanced:', { fromKey, toKey });
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      const phaseKey = getPhaseKey(state);
      if (phaseKey) {
        const onEnterResult = onEnterPhase(state, fromKey, phaseKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      console.error('[SPECIES_SELECT] Phase advance failed:', advanceResult.error);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
    }
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// SPECIES_SUBMIT
// ============================================================================

type PlayerSpeciesPayload = SpeciesRevealPayload['species'];

function isPlayerSpeciesPayload(value: unknown): value is PlayerSpeciesPayload {
  return value === 'human' ||
    value === 'xenite' ||
    value === 'centaur' ||
    value === 'ancient';
}

function isComputerBotSpeciesPayload(value: unknown): value is ComputerBotSpeciesPayload {
  return value === 'human' || value === 'xenite' || value === 'centaur';
}

function toBotSpeciesId(species: ComputerBotSpeciesPayload): BotSpeciesId {
  switch (species) {
    case 'human':
      return 'HUM';
    case 'xenite':
      return 'XEN';
    case 'centaur':
      return 'CEN';
  }
}

function fromBotSpeciesId(speciesId: unknown): ComputerBotSpeciesPayload | null {
  switch (speciesId) {
    case 'HUM':
      return 'human';
    case 'XEN':
      return 'xenite';
    case 'CEN':
      return 'centaur';
    default:
      return null;
  }
}

function chooseDeterministicBotPlanIdForSpecies(
  species: ComputerBotSpeciesPayload,
  seed: string,
  existingPlanId: string | null,
): string | null {
  switch (species) {
    case 'human':
      return existingPlanId && getHumanBotPlanById(existingPlanId)
        ? existingPlanId
        : chooseDeterministicHumanBotPlanId(seed);
    case 'xenite':
      return existingPlanId && getXeniteBotPlanById(existingPlanId)
        ? existingPlanId
        : chooseDeterministicXeniteBotPlanId(seed);
    case 'centaur':
      return existingPlanId && getCentaurBotPlanById(existingPlanId)
        ? existingPlanId
        : chooseDeterministicCentaurBotPlanId(seed);
  }
}

function getComputerBotSeat(state: any): { player: any; controller: any } | null {
  const controllersByPlayerId = state?.controllersByPlayerId ?? {};
  const activePlayers = (state?.players ?? []).filter((p: any) => p?.role === 'player');

  for (const candidate of activePlayers) {
    const controller = controllersByPlayerId?.[candidate?.id];
    if (controller?.kind === 'bot') {
      return { player: candidate, controller };
    }
  }

  return null;
}

function upsertPhaseReadiness(state: any, playerId: string, phaseKey: string) {
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.phaseReadiness) {
    state.gameData.phaseReadiness = [];
  }

  const existingIndex = state.gameData.phaseReadiness.findIndex(
    (r: any) => r.playerId === playerId
  );

  if (existingIndex >= 0) {
    state.gameData.phaseReadiness[existingIndex].isReady = true;
    state.gameData.phaseReadiness[existingIndex].currentStep = phaseKey;
  } else {
    state.gameData.phaseReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey
    });
  }
}

function appendSpeciesSubmittedEvents(
  events: any[],
  playerId: string,
  turnNumber: number,
  phaseKey: string,
  nowMs: number,
) {
  events.push({
    type: 'SPECIES_SUBMITTED',
    playerId,
    turnNumber,
    atMs: nowMs
  });

  events.push({
    type: 'PLAYER_READY',
    playerId,
    step: phaseKey,
    atMs: nowMs
  });
}

async function handleSpeciesSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can submit species
  if (!player || player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot submit species'
      }
    };
  }
  
  // Phase gate: SPECIES_SUBMIT only allowed during setup.species_selection
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'setup.species_selection') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'SPECIES_SUBMIT is only allowed during setup.species_selection phase'
      }
    };
  }
  
  if (!intent.payload || !intent.nonce) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload or nonce'
      }
    };
  }

  // Validate species payload
  const payload = intent.payload as SpeciesSubmitPayload;

  if (!isPlayerSpeciesPayload(payload.species)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.INVALID_SPECIES,
        message: `Invalid species: ${payload.species}`
      }
    };
  }

  const botSpeciesProvided = Object.prototype.hasOwnProperty.call(payload, 'botSpecies');
  if (botSpeciesProvided && !isComputerBotSpeciesPayload(payload.botSpecies)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.INVALID_SPECIES,
        message: `Invalid computer species: ${payload.botSpecies}`
      }
    };
  }

  const botSeat = getComputerBotSeat(state);
  const isComputerGame = botSeat !== null;
  const isSubmittingBot = botSeat?.player?.id === playerId;
  const isHumanSubmittingComputerGame = isComputerGame && !isSubmittingBot;
  const requestedBotSpecies = botSpeciesProvided
    ? payload.botSpecies as ComputerBotSpeciesPayload
    : null;

  if (!isComputerGame && botSpeciesProvided) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'botSpecies is only valid for computer games'
      }
    };
  }

  if (isComputerGame && botSpeciesProvided && !isHumanSubmittingComputerGame) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'botSpecies is only valid for human player computer species selection'
      }
    };
  }

  if (isHumanSubmittingComputerGame && !requestedBotSpecies) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing botSpecies for computer game species selection'
      }
    };
  }

  if (isSubmittingBot) {
    const controllerSpecies = fromBotSpeciesId(botSeat?.controller?.speciesId);
    if (!controllerSpecies) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Bot controller has no species selected'
        }
      };
    }

    if (controllerSpecies !== payload.species) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SPECIES,
          message: 'Bot species submit does not match controller species'
        }
      };
    }
  }

  if (isHumanSubmittingComputerGame && requestedBotSpecies && botSeat) {
    const existingBotFaction = botSeat.player?.faction;
    const existingControllerSpecies = fromBotSpeciesId(botSeat.controller?.speciesId);

    if (existingBotFaction && existingBotFaction !== requestedBotSpecies) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DUPLICATE_COMMIT,
          message: 'Computer species already selected'
        }
      };
    }

    if (existingControllerSpecies && existingControllerSpecies !== requestedBotSpecies) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DUPLICATE_COMMIT,
          message: 'Computer species already selected'
        }
      };
    }
  }

  const canonicalRevealPayload: SpeciesRevealPayload = {
    species: payload.species,
    ...(requestedBotSpecies ? { botSpecies: requestedBotSpecies } : {}),
  };
  
  // Idempotent check: if player already has faction set
  if (player.faction) {
    if (player.faction === payload.species) {
      if (isHumanSubmittingComputerGame && requestedBotSpecies && botSeat) {
        const nextBotSpeciesId = toBotSpeciesId(requestedBotSpecies);
        const existingPlanId =
          typeof botSeat.controller?.chosenPlanId === 'string' && botSeat.controller.chosenPlanId.length > 0
            ? botSeat.controller.chosenPlanId
            : null;
        const nextPlanId = chooseDeterministicBotPlanIdForSpecies(
          requestedBotSpecies,
          state.gameId ?? intent.gameId,
          existingPlanId,
        );

        botSeat.player.faction = requestedBotSpecies;
        if (!state.controllersByPlayerId) {
          state.controllersByPlayerId = {};
        }
        state.controllersByPlayerId[botSeat.player.id] = {
          kind: 'bot',
          speciesId: nextBotSpeciesId,
          chosenPlanId: nextPlanId,
        };
        state = ensureMissionChallengeAssignment(state, {
          completedMissionIds: payload.completedMissionIds,
        });
      }

      debugLog('[SPECIES_SUBMIT] applied', {
        playerId,
        species: payload.species,
        botSpecies: requestedBotSpecies,
        idempotent: true,
      });
      
      state = syncPhaseFields(state);
      return {
        ok: true,
        state,
        events: []
      };
    } else {
      // Different species - reject
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DUPLICATE_COMMIT,
          message: 'Species already selected'
        }
      };
    }
  }
  
  const commitKey = getSpeciesCommitKey(intent.turnNumber);
  
  // Check for duplicate commit before mutating canonical state.
  if (hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Species already submitted for this turn'
      }
    };
  }
  
  // Compute commit hash
  const { makeCommitHash } = await import('./Hash.ts');
  const commitHash = await makeCommitHash(canonicalRevealPayload, intent.nonce);

  // Immediately set faction on submit (CANONICAL)
  player.faction = payload.species;

  if (isHumanSubmittingComputerGame && requestedBotSpecies && botSeat) {
    const nextBotSpeciesId = toBotSpeciesId(requestedBotSpecies);
    const existingPlanId =
      typeof botSeat.controller?.chosenPlanId === 'string' && botSeat.controller.chosenPlanId.length > 0
        ? botSeat.controller.chosenPlanId
        : null;
    const nextPlanId = chooseDeterministicBotPlanIdForSpecies(
      requestedBotSpecies,
      state.gameId ?? intent.gameId,
      existingPlanId,
    );

    botSeat.player.faction = requestedBotSpecies;
    if (!state.controllersByPlayerId) {
      state.controllersByPlayerId = {};
    }
    state.controllersByPlayerId[botSeat.player.id] = {
      kind: 'bot',
      speciesId: nextBotSpeciesId,
      chosenPlanId: nextPlanId,
    };
    state = ensureMissionChallengeAssignment(state, {
      completedMissionIds: payload.completedMissionIds,
    });
  }
  
  debugLog('[SPECIES_SUBMIT] applied', {
    playerId,
    species: payload.species,
    botSpecies: requestedBotSpecies,
  });

  // Store commit and reveal together (atomic submission)
  storeCommit(state, commitKey, playerId, commitHash, nowMs);
  storeReveal(
    state,
    commitKey,
    playerId,
    canonicalRevealPayload,
    intent.nonce,
    nowMs,
  );
  
  // Mark player as ready for this phase (stops clock and updates status)
  upsertPhaseReadiness(state, playerId, phaseKey);
  appendSpeciesSubmittedEvents(events, playerId, intent.turnNumber, phaseKey, nowMs);

  if (isHumanSubmittingComputerGame && botSeat) {
    upsertPhaseReadiness(state, botSeat.player.id, phaseKey);
    appendSpeciesSubmittedEvents(events, botSeat.player.id, intent.turnNumber, phaseKey, nowMs);
  }
  
  // Completion check: advance when both players have faction set (not based on commit store)
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const bothChosen = hasCompletedSpeciesSelection(state);
  
  if (bothChosen) {
    debugLog('[SPECIES_SUBMIT] both chosen -> advance', { turnNumber: state.gameData.turnNumber });
    
    events.push({
      type: 'SPECIES_RESOLVED',
      turnNumber: intent.turnNumber,
      atMs: nowMs
    });

    const isNormalMultiplayer = activePlayers.length === 2 && getComputerBotSeat(state) === null;

    if (isNormalMultiplayer) {
      if (!state.gameData.turnData) {
        state.gameData.turnData = {};
      }

      if (!isCurrentMatchupIntroHold(state)) {
        state.gameData.turnData.phaseHold = {
          phaseKey: 'setup.species_selection',
          holdReason: 'matchup_intro',
          holdStartedAtMs: nowMs,
          holdUntilMs: nowMs + MATCHUP_INTRO_DURATION_MS,
        };
      }

      state = syncPhaseFields(state);
      return {
        ok: true,
        state,
        events,
      };
    }
    
    if (
      isComputerGame &&
      MISSION_INTRO_GATE_ENABLED &&
      state.missionChallengeAssignment?.introPending === true
    ) {
      return {
        ok: true,
        state: syncPhaseFields(state),
        events,
      };
    }

    return releaseCompletedSpeciesSelectionSetup(state, nowMs, events);
  } else {
    debugLog('[SPECIES_SUBMIT] Waiting for other player(s) to submit...');
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// MISSION_INTRO_ACK
// ============================================================================

function handleMissionIntroAck(
  state: any,
  playerId: string,
  nowMs: number,
  events: any[],
): IntentResult {
  const assignment = state?.missionChallengeAssignment;
  const player = state?.players?.find((candidate: any) => candidate?.id === playerId);
  const isAssignedHuman =
    assignment?.playerId === playerId &&
    player?.role === 'player' &&
    state?.controllersByPlayerId?.[playerId]?.kind === 'human';

  if (!isAssignedHuman) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.MISSION_INTRO_UNAVAILABLE,
        message: 'No Mission intro is available for this participant',
      },
    };
  }

  if (assignment.introPending !== true) {
    return {
      ok: true,
      state: syncPhaseFields(state),
      events,
    };
  }

  state = {
    ...state,
    missionChallengeAssignment: {
      ...assignment,
      introPending: false,
    },
  };

  if (
    getPhaseKey(state) === 'setup.species_selection' &&
    getComputerBotSeat(state) !== null &&
    hasCompletedSpeciesSelection(state)
  ) {
    return releaseCompletedSpeciesSelectionSetup(state, nowMs, events);
  }

  return {
    ok: true,
    state: syncPhaseFields(state),
    events,
  };
}

// Maximum build count per ship type to prevent state bloat
const MAX_BUILD_COUNT = 50;
// ============================================================================
// BUILD_SUBMIT
// ============================================================================

async function handleBuildSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can submit build
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot submit build'
      }
    };
  }
  
  // B1) Phase gate: BUILD_SUBMIT only allowed during build.drawing
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'build.drawing') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'BUILD_SUBMIT is only allowed during build.drawing phase'
      }
    };
  }

  const playerPrelude = getCurrentDrawingPreludePlayerState(state, playerId);
  if (!playerPrelude) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DRAWING_PRELUDE_INCOMPLETE,
        message: 'Current Drawing-prelude requester state is missing or malformed',
      },
    };
  }
  if (playerPrelude.status !== 'complete') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DRAWING_PRELUDE_INCOMPLETE,
        message: 'Drawing-prelude actions must be completed before build submission',
      },
    };
  }

  // B2) Validate payload
  if (!intent.payload || !intent.nonce) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload or nonce'
      }
    };
  }
  
  const payload = intent.payload as BuildSubmitPayload;
  
  if (!payload.builds || !Array.isArray(payload.builds)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Invalid build payload: must have builds array'
      }
    };
  }
  
  // Basic validation of build entries
  for (const build of payload.builds) {
    if (!build.shipDefId || typeof build.shipDefId !== 'string') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SHIP,
          message: 'Each build must have a valid shipDefId'
        }
      };
    }
    
    // Validate shipDefId exists in authoritative server definitions
    const shipDef = getShipById(build.shipDefId);
    if (!shipDef) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SHIP,
          message: `Unknown shipDefId: ${build.shipDefId}`
        }
      };
    }

    if (isEvolvedXeniteShipDefId(build.shipDefId)) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Invalid build payload: OXI and AST cannot be built directly; use Evolver conversion.'
        }
      };
    }
    
    // Validate count is positive integer
    if (!Number.isInteger(build.count) || build.count < 1) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be positive integer.`
        }
      };
    }
    
    // Check bounds: 1 <= count <= MAX_BUILD_COUNT
    if (build.count > MAX_BUILD_COUNT) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be 1..${MAX_BUILD_COUNT}`
        }
      };
    }
  }

  // Validate ordered permanent/trigger selected-number payloads.
  const frigateBuildCount = payload.builds
    .filter(b => b.shipDefId === 'FRI')
    .reduce((sum, b) => sum + (b.count ?? 0), 0);
  const frigateTriggerValidation = validateSelectedNumberArray({
    raw: payload.frigateTriggers,
    expectedCount: frigateBuildCount,
    fieldName: 'frigateTriggers',
    required: false,
  });
  if (!frigateTriggerValidation.ok) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: frigateTriggerValidation.message,
      },
    };
  }

  const quantumMysticBuildCount = payload.builds
    .filter((build) => build.shipDefId === 'QUA')
    .reduce((sum, build) => sum + (build.count ?? 0), 0);
  const quantumMysticSelectionValidation = validateSelectedNumberArray({
    raw: payload.quantumMysticSelections,
    expectedCount: quantumMysticBuildCount,
    fieldName: 'quantumMysticSelections',
    required: quantumMysticBuildCount > 0,
  });
  if (!quantumMysticSelectionValidation.ok) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: quantumMysticSelectionValidation.message,
      },
    };
  }

  const existingEvolverCount = countFleetShipsByDefId(state, playerId, 'EVO');
  const existingXenCount = countFleetShipsByDefId(state, playerId, 'XEN');
  const builtEvolverCount = payload.builds
    .filter((build) => build.shipDefId === 'EVO')
    .reduce((sum, build) => sum + build.count, 0);
  const builtXenCount = payload.builds
    .filter((build) => build.shipDefId === 'XEN')
    .reduce((sum, build) => sum + build.count, 0);

  const evolverValidation = validateEvolverChoicesPayload(
    payload,
    existingEvolverCount + builtEvolverCount,
    existingXenCount + builtXenCount
  );

  if (!evolverValidation.ok) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: evolverValidation.message,
      },
    };
  }
  
  // B3) Compute commit hash and store submission
  const turnNumber = intent.turnNumber;
  const commitKey = getBuildCommitKey(turnNumber);
  
  // Check for duplicate commit
  if (hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Build already submitted for this turn'
      }
    };
  }
  
  // Compute commit hash
  const { makeCommitHash } = await import('./Hash.ts');
  const commitHash = await makeCommitHash(intent.payload, intent.nonce);
  
  // Store commit and reveal together (atomic submission)
  storeCommit(state, commitKey, playerId, commitHash, nowMs);
  storeReveal(state, commitKey, playerId, intent.payload, intent.nonce, nowMs);
  
  // Mark player as ready for this phase (stops clock and updates status)
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.phaseReadiness) {
    state.gameData.phaseReadiness = [];
  }
  
  // Upsert readiness entry (one record per player)
  const existingIndex = state.gameData.phaseReadiness.findIndex(
    (r: any) => r.playerId === playerId
  );
  
  if (existingIndex >= 0) {
    // Update existing record: set ready for current phase
    state.gameData.phaseReadiness[existingIndex].isReady = true;
    state.gameData.phaseReadiness[existingIndex].currentStep = phaseKey;
  } else {
    // Create new record
    state.gameData.phaseReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey
    });
  }
  
  events.push({
    type: 'BUILD_SUBMITTED',
    playerId,
    turnNumber: turnNumber,
    atMs: nowMs
  });
  
  events.push({
    type: 'PLAYER_READY',
    playerId,
    step: phaseKey,
    atMs: nowMs
  });
  
  // B4) Completion check: if all active players have submitted
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const allSubmitted = activePlayers.every((p: any) => hasRevealed(state, commitKey, p.id));
  
  if (allSubmitted) {
    debugLog('[BUILD_SUBMIT] All players submitted, applying builds and advancing phase...');
    
    // Ensure turnData exists (idempotency)
    if (!state.gameData) state.gameData = {};
    if (!state.gameData.turnData) state.gameData.turnData = {};

    const resolution = resolveBuildSubmitAuthoritatively({
      state,
      turnNumber,
      nowMs,
    });
    state = resolution.state;
    events.push(...resolution.events);

    if (resolution.alreadyApplied) {
      console.warn('[BUILD_SUBMIT] Builds already applied for this turn; attempting phase advance only.', {
        turnNumber
      });
    }
    
    events.push({
      type: 'BUILD_RESOLVED',
      turnNumber: turnNumber,
      atMs: nowMs
    });
    
    // B6) Advance phase
    const fromKey = phaseKey;
    
    const advanceResult = advancePhaseCore(state, nowMs);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // Clear readiness on successful phase advance
      state.gameData.phaseReadiness = [];
      state = syncPhaseFields(state);
      
      const toKey = getPhaseKey(state);
      
      debugLog(`[BUILD_SUBMIT] Phase advanced: ${fromKey} → ${toKey}`);
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      if (toKey) {
        const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      console.error(`[BUILD_SUBMIT] Phase advance blocked: ${advanceResult.error}`);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
    }
  } else {
    debugLog('[BUILD_SUBMIT] Waiting for other player(s) to submit...');
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

function stageFirstStrikeSelection(state: any, playerId: string, payload: ActionPayload) {
  if (payload.actionType !== 'power') return;
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const pending = state.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId || {};
  const playerPending = pending[playerId] || {};

  playerPending[payload.sourceInstanceId!] = {
    actionId: payload.actionId,
    sourceInstanceId: payload.sourceInstanceId!,
    choiceId: payload.choiceId!,
    targetInstanceId: payload.targetInstanceId,
    targetInstanceIds: payload.targetInstanceIds,
  };

  pending[playerId] = playerPending;
  state.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId = pending;
}

function resolvePendingFirstStrikeSelections(state: any, nowMs: number, events: any[]) {
  const pendingByPlayerId = state?.gameData?.turnData?.pendingFirstStrikeSelectionsByPlayerId || {};
  const phaseKey = 'battle.first_strike' as const;
  const stateBeforeResolution = state;
  const selections = Object.entries(pendingByPlayerId)
    .flatMap(([playerId, entries]) => Object.values(entries as Record<string, any>).map((entry: any) => ({ playerId, ...entry })));

  if (selections.length === 0) {
    return state;
  }

  let workingState = state;
  let activationSources: ShipActivationCueSource[] = [];
  const prepared = selections.map((selection: any) => ({
    selection,
    outcome: resolvePowerAction({
      state,
      playerId: selection.playerId,
      phaseKey,
      actionId: selection.actionId,
      sourceInstanceId: selection.sourceInstanceId,
      choiceId: selection.choiceId,
      targetInstanceId: selection.targetInstanceId,
      targetInstanceIds: selection.targetInstanceIds,
      apply: false,
    })
  }));

  const allEffects = prepared.flatMap((item: any) => item.outcome.effects || []);
  if (allEffects.length > 0) {
    const applied = applyEffects(workingState, allEffects);
    workingState = applied.state;
    events.push(...applied.events);
    activationSources = getShipActivationSourcesFromAppliedEffects(
      allEffects,
      applied.events
    );

    const effectEvents = getEffectEventsFromOutcomeEvents(applied.events);
    for (const item of prepared) {
      events.push(
        ...createBattleLogBattleCaptureEventsFromResolution({
          stateBeforeResolution,
          turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
          playerId: item.selection.playerId,
          phaseKey,
          choiceId: item.selection.choiceId,
          effects: item.outcome.effects || [],
          effectEvents,
        }),
      );
    }
  }

  const onceOnlyFiredKeys = prepared.flatMap((item: any) => item.outcome.onceOnlyFiredKeys || []);
  if (onceOnlyFiredKeys.length > 0) {
    if (!workingState.gameData) workingState.gameData = {};
    if (!workingState.gameData.powerMemory) workingState.gameData.powerMemory = {};

    const currentOnceOnlyFired = workingState.gameData.powerMemory.onceOnlyFired || {};
    workingState.gameData.powerMemory.onceOnlyFired = {
      ...currentOnceOnlyFired,
      ...Object.fromEntries(onceOnlyFiredKeys.map((key: string) => [key, true])),
    };
  }

  for (const item of prepared) {
    if (item.outcome.spentCharge) {
      const gd: any = workingState.gameData ?? (workingState.gameData = {});
      const td: any = gd.turnData ?? (gd.turnData = {});
      const turnNumber: number = gd.turnNumber ?? (workingState as any).turnNumber ?? 1;
      const usedMap: Record<string, number> = td.chargePowerUsedByInstanceId || {};
      td.chargePowerUsedByInstanceId = {
        ...usedMap,
        [item.selection.sourceInstanceId]: turnNumber,
      };
    }

    events.push({
      type: 'POWER_USED',
      playerId: item.selection.playerId,
      phaseKey,
      actionId: item.selection.actionId,
      sourceInstanceId: item.selection.sourceInstanceId,
      choiceId: item.selection.choiceId,
      targetInstanceId: item.selection.targetInstanceId,
      targetInstanceIds: item.selection.targetInstanceIds,
      spentCharge: item.outcome.spentCharge,
      atMs: nowMs,
    });
  }

  if (!workingState.gameData) workingState.gameData = {};
  if (!workingState.gameData.turnData) workingState.gameData.turnData = {};
  delete workingState.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId;

  return appendShipActivationCueBatch(workingState, {
    key: `ship-activation:${
      workingState.gameData?.turnData?.turnNumber ??
      workingState.gameData?.turnNumber ??
      workingState.turnNumber ??
      0
    }:${phaseKey}`,
    phaseKey,
    sources: activationSources,
  });
}

// ============================================================================
// ATOMIC ANCIENT CHARGE DECLARATION
// ============================================================================

function handleChargeDeclarationSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[],
): IntentResult {
  try {
    const resolved = resolveChargeDeclarationSubmission({
      state,
      playerId,
      payload: intent.payload as ChargeDeclarationSubmitPayload,
      nowMs,
    });
    if (resolved.status === 'idempotent') {
      return { ok: true, state: resolved.state, events: [] };
    }
    events.push(...resolved.events);
    return markPlayerReadyAndAdvance(resolved.state, playerId, intent, nowMs, events);
  } catch (error: any) {
    const message = error?.message ?? String(error);
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: isChargeDeclarationLegalityInvariantError(error)
          ? RejectionCode.INTERNAL_ERROR
          : message.includes('only allowed during')
          ? RejectionCode.WRONG_PHASE
          : RejectionCode.BAD_PAYLOAD,
        message,
      },
    };
  }
}

// ============================================================================
// DECLARE_READY
// ============================================================================

function handleDeclareReady(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  return markPlayerReadyAndAdvance(state, playerId, intent, nowMs, events);
}

function markPlayerReadyAndAdvance(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  // Get stable phase key
  const phaseKey = getPhaseKey(state);
  
  if (!phaseKey) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'Cannot determine current phase'
      }
    };
  }
  
  // Validate turn number matches current server turn (reject stale DECLARE_READY)
  const stateTurnNumber = state?.gameData?.turnData?.turnNumber ?? state?.gameData?.turnNumber ?? state?.turnNumber;
  const intentTurnNumber = intent.turnNumber;
  
  if (intentTurnNumber !== stateTurnNumber) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_TURN,
        message: `Stale DECLARE_READY: intent turn ${intentTurnNumber} but current turn is ${stateTurnNumber}`
      }
    };
  }

  if (phaseKey === 'build.drawing') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.PHASE_NOT_ALLOWED,
        message: 'DECLARE_READY is not accepted during build.drawing',
      },
    };
  }

  if (
    phaseKey === 'build.dice_roll' &&
    state?.gameData?.turnData?.diceManipulationStage === 'cube' &&
    playerIsCubeEligible(state, playerId) &&
    !playerHasValidPendingCubeChoice(state, playerId)
  ) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'MISSING_CUBE_DICE_CHOICE',
      },
    };
  }
  
  // Ensure phaseReadiness array exists
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.phaseReadiness) {
    state.gameData.phaseReadiness = [];
  }
  
  // Upsert readiness entry (FIX 1: one record per player)
  const existingIndex = state.gameData.phaseReadiness.findIndex(
    (r: any) => r.playerId === playerId
  );
  
  if (existingIndex >= 0) {
    // Update existing record: set ready for current phase
    state.gameData.phaseReadiness[existingIndex].isReady = true;
    state.gameData.phaseReadiness[existingIndex].currentStep = phaseKey;
  } else {
    // Create new record
    state.gameData.phaseReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey
    });
  }
  
  events.push({
    type: 'PLAYER_READY',
    playerId,
    step: phaseKey,
    atMs: nowMs
  });
  
  // Check if all active players are ready for current phase
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const readyPlayers = state.gameData.phaseReadiness.filter(
    (r: any) => r.currentStep === phaseKey && r.isReady
  );
  
  const allReady = activePlayers.length > 0 && 
    activePlayers.every((p: any) => 
      readyPlayers.some((r: any) => r.playerId === p.id)
    );
  
  if (allReady) {
    debugLog(`[IntentReducer] All players ready for ${phaseKey}, advancing phase...`);

    if (phaseKey === 'battle.first_strike') {
      state = resolvePendingFirstStrikeSelections(state, nowMs, events);
    }
    if (phaseKey === 'build.dice_roll') {
      const stage = state?.gameData?.turnData?.diceManipulationStage;
      if (stage === 'kno') {
        state = resolvePendingKnoRerollPass(state, nowMs, events);
      } else if (stage === 'cube') {
        state = resolvePendingCubeDiceChoices(state, nowMs, events);
      }
    }
    
    // Store current phase key for onEnterPhase
    const fromKey = phaseKey;
    
    // Advance phase using canonical phase engine
    const advanceResult = advancePhaseCore(state, nowMs);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // FIX 3: Clear readiness on successful phase advance
      state.gameData.phaseReadiness = [];
      events.push(...advanceResult.events);
      
      // Sync phase fields
      state = syncPhaseFields(state);
      
      // Get new phase key
      const toKey = getPhaseKey(state);
      
      debugLog(`[IntentReducer] Phase advanced: ${fromKey} → ${toKey}`);
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      if (toKey) {
        const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      // FIX 2: Emit event when phase advance is blocked
      debugLog(`[IntentReducer] Phase advance blocked: ${advanceResult.error}`);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
      
      // Don't fail the DECLARE_READY - just emit event for debugging
    }
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// CONTINUE_PHASE_HOLD
// ============================================================================

function handleContinuePhaseHold(
  state: any,
  playerId: string,
  _intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const phaseKey = getPhaseKey(state);
  const phaseHold = getCurrentPhaseHold(state);

  if (!phaseKey || !phaseHold || phaseHold.phaseKey !== phaseKey) {
    return {
      ok: true,
      state: syncPhaseFields(state),
      events,
    };
  }

  if (!isSupportedPhaseHoldReason(phaseHold.holdReason)) {
    return {
      ok: true,
      state: syncPhaseFields(state),
      events,
    };
  }

  const holdUntilMs =
    typeof phaseHold.holdUntilMs === 'number' ? phaseHold.holdUntilMs : Number.NaN;

  if (!Number.isFinite(holdUntilMs) || holdUntilMs > nowMs) {
    return {
      ok: true,
      state: syncPhaseFields(state),
      events,
    };
  }

  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.turnData) {
    state.gameData.turnData = {};
  }

  delete state.gameData.turnData.phaseHold;

  events.push({
    type: 'PHASE_HOLD_CONTINUED',
    playerId,
    phaseKey,
    holdReason: phaseHold.holdReason,
    atMs: nowMs,
  });

  if (state.status === 'finished') {
    state = syncPhaseFields(state);
    return {
      ok: true,
      state,
      events,
    };
  }

  if (phaseKey === 'setup.species_selection') {
    return releaseCompletedSpeciesSelectionSetup(state, nowMs, events);
  }

  const fromKey = phaseKey;
  const advanceResult = advancePhaseCore(state, nowMs);

  if (!advanceResult.ok) {
    events.push({
      type: 'PHASE_ADVANCE_BLOCKED',
      from: fromKey,
      reason: advanceResult.error,
      atMs: nowMs,
    });

    state = syncPhaseFields(state);
    return {
      ok: true,
      state,
      events,
    };
  }

  state = advanceResult.state;
  events.push(...advanceResult.events);
  state = syncPhaseFields(state);

  const toKey = getPhaseKey(state);

  events.push({
    type: 'PHASE_ADVANCED',
    from: fromKey,
    to: toKey,
    atMs: nowMs,
  });

  if (toKey) {
    const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
    state = onEnterResult.state;
    events.push(...onEnterResult.events);
  }

  state = syncPhaseFields(state);

  return {
    ok: true,
    state,
    events,
  };
}

// ============================================================================
// ACTION (message + power scaffold)
// ============================================================================

function handleAction(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  if (!intent.payload) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload'
      }
    };
  }
  
  const payload = intent.payload as ActionPayload;
  
  // Handle message actions
  if (payload.actionType === 'message') {
    if (!payload.content || typeof payload.content !== 'string') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing or invalid message content'
        }
      };
    }
    
    // Emit CHAT_MESSAGE event for route layer to persist separately
    const player = state.players.find((p: any) => p.id === playerId);
    
    events.push({
      type: 'CHAT_MESSAGE',
      chatEntryType: 'message',
      playerId,
      playerName: player?.name || 'Unknown',
      content: payload.content,
      timestamp: nowMs
    });
    
    state = syncPhaseFields(state);
    
    return {
      ok: true,
      state,
      events
    };
  }
  
  // Handle power actions
  if (payload.actionType === 'power') {
    const drawingPreludePhaseKey = getPhaseKey(state);
    if (drawingPreludePhaseKey === 'build.drawing') {
      return toIntentResultFromDrawingPrelude(resolveDrawingPreludePowerAction({
        state,
        playerId,
        action: payload,
        nowMs,
      }));
    }

    // ============================================================================
    // VALIDATION: Required fields
    // ============================================================================
    if (!payload.actionId || typeof payload.actionId !== 'string' || payload.actionId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing actionId'
        }
      };
    }
    
    if (!payload.sourceInstanceId || typeof payload.sourceInstanceId !== 'string' || payload.sourceInstanceId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing sourceInstanceId'
        }
      };
    }
    
    if (!payload.choiceId || typeof payload.choiceId !== 'string' || payload.choiceId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing choiceId'
        }
      };
    }
    
    // ============================================================================
    // DELEGATE TO RESOLVER (timing enforced there)
    // ============================================================================
    const phaseKey = getPhaseKey(state);
    if (!phaseKey) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Cannot determine current phase'
        }
      };
    }

    try {
      if (phaseKey === 'battle.charge_declaration') {
        requireChargeDeclarationLegalityState(state);
      }

      if (phaseKey === 'build.dice_roll') {
        if (state?.gameData?.turnData?.diceManipulationStage === 'cube') {
          stageCubeDiceChoice(
            state,
            playerId,
            payload.sourceInstanceId,
            payload.actionId,
            payload.choiceId,
          );
        } else {
          stageKnoRerollChoice(
            state,
            playerId,
            payload.sourceInstanceId,
            payload.actionId,
            payload.choiceId
          );
        }
        state = syncPhaseFields(state);

        return {
          ok: true,
          state,
          events
        };
      }

      if (phaseKey === 'battle.first_strike') {
        resolvePowerAction({
          state,
          playerId,
          phaseKey,
          actionId: payload.actionId,
          sourceInstanceId: payload.sourceInstanceId,
          choiceId: payload.choiceId,
          targetInstanceId: payload.targetInstanceId,
          targetInstanceIds: payload.targetInstanceIds,
          apply: false,
        });

        stageFirstStrikeSelection(state, playerId, payload);
        state = syncPhaseFields(state);

        return {
          ok: true,
          state,
          events
        };
      }

      const stateBeforeResolution = state;
      const outcome = resolvePowerAction({
        state,
        playerId,
        phaseKey,
        actionId: payload.actionId,
        sourceInstanceId: payload.sourceInstanceId,
        choiceId: payload.choiceId,
        targetInstanceId: payload.targetInstanceId,
        targetInstanceIds: payload.targetInstanceIds,
      });
      
      state = outcome.state;
      const effectEvents = getEffectEventsFromOutcomeEvents(outcome.events);
      if (phaseKey === 'battle.charge_declaration') {
        recordChargeDeclarationSpendAcknowledgements(state, playerId, effectEvents);
      }

      if (phaseKey === 'battle.charge_declaration') {
        events.push(
          ...createBattleLogBattleCaptureEventsFromResolution({
            stateBeforeResolution,
            turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
            playerId,
            phaseKey,
            choiceId: payload.choiceId,
            effects: outcome.effects || [],
            effectEvents,
          }),
        );
      }
      
      // ============================================================================
      // FLIP DECLARATION-SPENT FLAG (only in charge_declaration)
      // ============================================================================
      // ============================================================================
      // EMIT GENERIC EVENT
      // ============================================================================
      events.push({
        type: 'POWER_USED',
        playerId,
        phaseKey,
        actionId: payload.actionId,
        sourceInstanceId: payload.sourceInstanceId,
        choiceId: payload.choiceId,
        targetInstanceId: payload.targetInstanceId,
        targetInstanceIds: payload.targetInstanceIds,
        spentCharge: outcome.spentCharge,
        atMs: nowMs
      });

      state = appendShipActivationCueBatch(state, {
        phaseKey,
        sources: getShipActivationSourcesFromAppliedEffects(
          outcome.effects || [],
          effectEvents
        ),
      });
      
      state = syncPhaseFields(state);
      
      return {
        ok: true,
        state,
        events
      };
    } catch (err: any) {
      // ============================================================================
      // ERROR → REJECTION MAPPING
      // ============================================================================
      const msg = err?.message ?? String(err);
      
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: isChargeDeclarationLegalityInvariantError(err)
            ? RejectionCode.INTERNAL_ERROR
            : msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? RejectionCode.CHARGE_ALREADY_USED_THIS_TURN
            : RejectionCode.BAD_PAYLOAD,
          message: msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? 'This ship has already used a charge this turn.'
            : msg
        }
      };
    }
  }
  
  // Unknown action type
  return {
    ok: false,
    state,
    events: [],
    rejected: {
      code: RejectionCode.BAD_PAYLOAD,
      message: 'Unsupported action type'
    }
  };
}

// ============================================================================
// ACTIONS_SUBMIT (batch power actions)
// ============================================================================

function handleActionsSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  // ============================================================================
  // VALIDATION: Payload structure
  // ============================================================================
  if (!intent.payload) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload'
      }
    };
  }
  
  const payload = intent.payload as ActionsBatchPayload;
  
  if (!Array.isArray(payload.actions)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Payload must have actions array'
      }
    };
  }
  
  // ============================================================================
  // GET CURRENT PHASE
  // ============================================================================
  const phaseKey = getPhaseKey(state);
  if (!phaseKey) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Cannot determine current phase'
      }
    };
  }
  if (phaseKey === 'build.drawing') {
    return toIntentResultFromDrawingPrelude(resolveDrawingPreludePowerActionsBatch({
      state,
      playerId,
      actions: payload.actions,
      nowMs,
    }));
  }

  if (phaseKey === 'battle.charge_declaration') {
    try {
      requireChargeDeclarationLegalityState(state);
    } catch (error) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  if (
    phaseKey === 'build.dice_roll' &&
    state?.gameData?.turnData?.diceManipulationStage === 'cube'
  ) {
    if (payload.actions.length !== 1) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Cube Dice Manipulation requires exactly one CUB#0 action.',
        },
      };
    }

    const [cubeAction] = payload.actions;
    if (
      cubeAction?.actionType !== 'power' ||
      cubeAction?.actionId !== 'CUB#0' ||
      typeof cubeAction?.sourceInstanceId !== 'string' ||
      typeof cubeAction?.choiceId !== 'string'
    ) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Invalid Cube Dice Manipulation batch.',
        },
      };
    }

    try {
      validateCubeDiceChoice(
        state,
        playerId,
        cubeAction.sourceInstanceId,
        cubeAction.actionId,
        cubeAction.choiceId,
      );
    } catch (err: any) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: err?.message ?? String(err),
        },
      };
    }
  }
  
  // ============================================================================
  // BATCH PROCESSING: Apply each action atomically
  // ============================================================================
  const originalState = state;
  state = structuredClone(state);
  events = [];
  const activationSources: ShipActivationCueSource[] = [];
  const declarationSpendEffectEvents: EffectEvent[] = [];

  for (const item of payload.actions) {
    // Validate action type
    if (item.actionType !== 'power') {
      return {
        ok: false,
        state: originalState,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Only power actions are supported in batch'
        }
      };
    }
    
    // Validate required fields
    if (!item.actionId || typeof item.actionId !== 'string' || item.actionId.trim() === '') {
      return {
        ok: false,
        state: originalState,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing actionId'
        }
      };
    }
    
    if (!item.sourceInstanceId || typeof item.sourceInstanceId !== 'string' || item.sourceInstanceId.trim() === '') {
      return {
        ok: false,
        state: originalState,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing sourceInstanceId'
        }
      };
    }
    
    if (!item.choiceId || typeof item.choiceId !== 'string' || item.choiceId.trim() === '') {
      return {
        ok: false,
        state: originalState,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing choiceId'
        }
      };
    }
    
    try {
      if (phaseKey === 'build.dice_roll') {
        if (state?.gameData?.turnData?.diceManipulationStage === 'cube') {
          stageCubeDiceChoice(
            state,
            playerId,
            item.sourceInstanceId,
            item.actionId,
            item.choiceId,
          );
        } else {
          stageKnoRerollChoice(
            state,
            playerId,
            item.sourceInstanceId,
            item.actionId,
            item.choiceId
          );
        }
        continue;
      }

      if (phaseKey === 'battle.first_strike') {
        resolvePowerAction({
          state,
          playerId,
          phaseKey,
          actionId: item.actionId,
          sourceInstanceId: item.sourceInstanceId,
          choiceId: item.choiceId,
          targetInstanceId: item.targetInstanceId,
          targetInstanceIds: item.targetInstanceIds,
          apply: false,
        });

        stageFirstStrikeSelection(state, playerId, item);
        continue;
      }

      const stateBeforeResolution = state;
      const outcome = resolvePowerAction({
        state,
        playerId,
        phaseKey,
        actionId: item.actionId,
        sourceInstanceId: item.sourceInstanceId,
        choiceId: item.choiceId,
        targetInstanceId: item.targetInstanceId,
        targetInstanceIds: item.targetInstanceIds,
      });

      state = outcome.state;
      const effectEvents = getEffectEventsFromOutcomeEvents(outcome.events);
      if (phaseKey === 'battle.charge_declaration') {
        declarationSpendEffectEvents.push(
          ...effectEvents.filter((event) => event.kind === 'SpendCharge'),
        );
      }
      activationSources.push(
        ...getShipActivationSourcesFromAppliedEffects(
          outcome.effects || [],
          effectEvents
        )
      );

      if (phaseKey === 'battle.charge_declaration') {
        events.push(
          ...createBattleLogBattleCaptureEventsFromResolution({
            stateBeforeResolution,
            turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
            playerId,
            phaseKey,
            choiceId: item.choiceId,
            effects: outcome.effects || [],
            effectEvents,
          }),
        );
      }

      events.push({
        type: 'POWER_USED',
        playerId,
        phaseKey,
        actionId: item.actionId,
        sourceInstanceId: item.sourceInstanceId,
        choiceId: item.choiceId,
        targetInstanceId: item.targetInstanceId,
        targetInstanceIds: item.targetInstanceIds,
        spentCharge: outcome.spentCharge,
        atMs: nowMs
      });
    } catch (err: any) {
      // ERROR → Atomic rejection (entire batch fails)
      const msg = err?.message ?? String(err);
      
      return {
        ok: false,
        state: originalState,
        events: [],
        rejected: {
          code: isChargeDeclarationLegalityInvariantError(err)
            ? RejectionCode.INTERNAL_ERROR
            : msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? RejectionCode.CHARGE_ALREADY_USED_THIS_TURN
            : RejectionCode.BAD_PAYLOAD,
          message: msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? 'This ship has already used a charge this turn.'
            : msg
        }
      };
    }
  }

  if (phaseKey === 'battle.charge_declaration') {
    try {
      recordChargeDeclarationSpendAcknowledgements(
        state,
        playerId,
        declarationSpendEffectEvents,
      );
    } catch (error) {
      return {
        ok: false,
        state: originalState,
        events: [],
        rejected: {
          code: RejectionCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  
  // ============================================================================
  // BATCH COMPLETION: Emit wrapper event and sync once
  // ============================================================================
  if (phaseKey !== 'build.dice_roll') {
    events.push({
      type: 'POWERS_BATCH_SUBMITTED',
      playerId,
      phaseKey,
      count: payload.actions.length,
      atMs: nowMs
    });
  }

  state = appendShipActivationCueBatch(state, {
    phaseKey,
    sources: activationSources,
  });
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// SURRENDER
// ============================================================================

function handleSurrender(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can surrender
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot surrender'
      }
    };
  }
  
  // Find opponent
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const opponent = activePlayers.find((p: any) => p.id !== playerId);
  
  if (!opponent) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Cannot surrender: no opponent found'
      }
    };
  }

  return finishGameWithCanonicalResult({
    state,
    result: 'win',
    winnerPlayerId: opponent.id,
    resultReason: 'resignation',
    nowMs,
    events,
  });
}

// ============================================================================
// DRAW_OFFER
// ============================================================================

function handleDrawOffer(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can offer a draw
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot offer a draw'
      }
    };
  }

  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const opponent = activePlayers.find((p: any) => p.id !== playerId);

  if (!opponent) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Cannot offer a draw: no opponent found'
      }
    };
  }

  if (getLegacyCompatiblePendingDrawOffer(state)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'A draw offer is already pending'
      }
    };
  }

  const currentTurn = state.gameData?.turnNumber ?? state.turnNumber ?? 0;
  const lastDrawOfferTurn = state.gameData?.lastDrawOfferTurnByPlayerId?.[playerId];
  if (lastDrawOfferTurn === currentTurn) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'You have already offered a draw this turn'
      }
    };
  }

  if (!state.gameData) {
    state.gameData = {};
  }

  state.gameData.pendingDrawOffer = {
    offererPlayerId: playerId,
    offereePlayerId: opponent.id,
    offeredTurnNumber: currentTurn,
  };
  state.gameData.lastDrawOfferTurnByPlayerId = {
    ...(state.gameData.lastDrawOfferTurnByPlayerId ?? {}),
    [playerId]: currentTurn,
  };
  state.gameData.drawAgreement = {
    offeredBy: playerId,
    acceptedBy: [playerId],
  };

  events.push({
    type: 'DRAW_OFFERED',
    playerId,
    offereePlayerId: opponent.id,
    atMs: nowMs
  });

  state = syncPhaseFields(state);

  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// DRAW_ACCEPT
// ============================================================================

function handleDrawAccept(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can accept a draw
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot accept a draw'
      }
    };
  }

  const pendingDrawOffer = getLegacyCompatiblePendingDrawOffer(state);
  if (!pendingDrawOffer) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'No active draw offer'
      }
    };
  }

  if (pendingDrawOffer.offereePlayerId !== playerId) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Only the offeree may accept the pending draw offer'
      }
    };
  }

  const acceptedBy = state.gameData?.drawAgreement?.acceptedBy || [];
  if (!acceptedBy.includes(playerId)) {
    acceptedBy.push(playerId);
    if (!state.gameData.drawAgreement) {
      state.gameData.drawAgreement = {
        offeredBy: pendingDrawOffer.offererPlayerId,
        acceptedBy,
      };
    } else {
      state.gameData.drawAgreement.acceptedBy = acceptedBy;
    }
  }

  events.push({
    type: 'DRAW_ACCEPTED',
    playerId,
    atMs: nowMs
  });

  return finishGameWithCanonicalResult({
    state,
    result: 'draw',
    winnerPlayerId: null,
    resultReason: 'agreement',
    nowMs,
    events,
  });
}

// ============================================================================
// DRAW_REFUSE
// ============================================================================

function handleDrawRefuse(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);

  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot refuse a draw'
      }
    };
  }

  const pendingDrawOffer = getLegacyCompatiblePendingDrawOffer(state);
  if (!pendingDrawOffer) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'No active draw offer'
      }
    };
  }

  if (pendingDrawOffer.offereePlayerId !== playerId) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Only the offeree may refuse the pending draw offer'
      }
    };
  }

  clearPendingDrawOfferState(state);

  events.push({
    type: 'DRAW_REFUSED',
    playerId,
    atMs: nowMs
  });

  events.push({
    type: 'CHAT_MESSAGE',
    chatEntryType: 'system',
    content: 'Draw offer refused',
    timestamp: nowMs
  });

  state = syncPhaseFields(state);

  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get canonical phase key using buildPhaseKey
 */
function getPhaseKey(state: any) {
  const major = state.gameData?.currentPhase;
  const sub = state.gameData?.currentSubPhase;
  
  if (!major || !sub) {
    return null;
  }
  
  return buildPhaseKey(major, sub);
}
