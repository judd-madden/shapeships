/**
 * useGameSession - Game Controller Hook
 * 
 * This is the ONLY place allowed to:
 * - Poll /game-state/:gameId
 * - Map server state to view-models
 * - Expose action callbacks (currently no-ops)
 * - Manage client-only event tape for dev visibility
 * - Attempt one-time auto-join on mount
 * - Submit intents (commit/reveal protocol)
 * - Track local completion by phase instance
 * 
 * This hook must NOT:
 * - Validate actions
 * - Know real rules
 * - Compute eligibility
 * 
 * ALL state and actions flow through this hook.
 * Layout components remain PURE UI.
 */


import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { attemptMobileGameFullscreen } from '../../utils/mobileFullscreen';
import { authenticatedGet, authenticatedPost, ensureSession } from '../../utils/sessionManager';
import {
  normalizeActionPanelId,
  type ActionPanelId,
} from '../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipDefId } from '../types/ShipTypes.engine';
import type { ShipChoicesPanelGroup } from '../types/ShipChoiceTypes';
import type { FleetAnimVM } from '../display/graphics/animation';
import type { ActivationStaggerPlan } from '../display/graphics/animation-stagger';
import { computeActivationStaggerPlan } from '../display/graphics/animation-stagger';
import { getShipDefinitionById } from '../data/ShipDefinitions.engine';
import { isShipDefId } from '../data/ShipDefinitions.core';
import { buildShareGameUrl } from './config';
import { downloadBattleLog } from './downloadBattleLog';
import { generateNonce, makeCommitHash } from './hashUtils';
import { isValidPhaseKey } from '../../engine/phase/PhaseTable';
import { getPlayerName } from './gameSession/playerName';
import { getMajorPhaseLabel, getSubphaseLabelFromPhaseKey } from './gameSession/phaseLabels';
import {
  findPlayerByIdentity,
  getAvailableActions,
  getBonusBreakdownByPlayerId,
  getBonusLinesByPlayerId,
  getBonusLinesOnEvenByPlayerId,
  getChargeScopedFleetForPlayer,
  getChronoswarmRolls,
  getClockData,
  getCommitmentForPlayer,
  getCubeDiceUsedByPlayerId,
  getCubeDiceValueByPlayerId,
  getEffectiveDiceValueForPlayer,
  getFrigateTriggerByInstanceId,
  getGameStatus,
  getJoiningBonusLinesByPlayerId,
  getJoiningLinesByPlayerId,
  getKnoRerollPassIndex,
  getMaterializedSimulacrumLedgerEntryIdsByPlayerId,
  getLastTurnDamageByPlayerId,
  getLastTurnDamageDealtBreakdownByPlayerId,
  getLastTurnHealByPlayerId,
  getLastTurnHealingReceivedBreakdownByPlayerId,
  getLastTurnNetByPlayerId,
  getPhaseHold,
  getPhaseKey,
  getPlayerIdentityKey,
  getPublicAncientEnergyCapacityForPlayer,
  getPublicAncientEnergyForPlayer,
  getPublicTurnPhaseProgress,
  getResultReason,
  getSavedLinesByPlayerId,
  getShipActivationCueBatches,
  getShipsByPlayerId,
  getTurnNumber,
  getWinnerPlayerId,
  isGameFinished,
  isCommitmentCommitted,
  isPlayerReadyForPhase,
  formatClock,
  formatClockMs,
} from './gameSession/selectors';
import {
  canSubmitDrawingBuild,
  deriveDrawingStage,
  getDrawingPhaseInstanceSuffix,
  normalizeDrawingPrelude,
  validateProjectedCarrierActions,
  type DrawingViewerParticipation,
} from './gameSession/drawingPrelude';
import { deriveViewerSeats } from './gameSession/viewerSeats';
import {
  deriveFleets,
  orderFleetSummariesByRenderKey,
  reconcileFleetRenderKeys,
} from './gameSession/fleets';
import { appendEventsToTape } from './gameSession/eventTape';
import { usePhaseCommitCache } from './gameSession/commitCache';
import { mapGameSessionVm } from './gameSession/mapVm';
import { runSpeciesConfirmFlow, runReadyToggleFlow, maybeAutoRevealBuild, type CanonicalBuildSubmitPayload } from './gameSession/intents';
import {
  addShipToBuildDraft,
  canProvisionallyAddShip,
  evaluateProvisionalBuild,
  getDraftPreviewFrigateRowIds,
  getDraftPreviewQuantumMysticRowIds,
} from './gameSession/provisionalBuild';
import {
  usePollMarkerEffect,
  useFinishedMarkerEffect,
  useRoleCheckLoggingEffect,
  usePlayersFullSnapshotEffect,
  useSpectatorCountDebugEffect,
} from './gameSession/clienteffects/useDevEffects';
import { useChatPolling } from './gameSession/clienteffects/useChatPolling';
import { useAutoJoinEffect, usePollingEffect } from './gameSession/clienteffects/useNetworkingEffects';
import { useBuildPreviewResetEffect, useAutoRevealBuildEffect } from './gameSession/clienteffects/usePhaseAutomationEffects';
import { useFleetOrder } from './gameSession/clienteffects/useFleetOrder';
import {
  useFleetAnimTokens,
  type ResolvedFleetActivationEvent,
} from './gameSession/clienteffects/useFleetAnimTokens';
import { useUntimedPollingThrottle } from './gameSession/clienteffects/useUntimedPollingThrottle';
import {
  buildPhaseHoldSignature,
  useEndOfTurnPresentation,
  type ContinueAuthoritativePhaseHoldArgs,
  type ContinueAuthoritativePhaseHoldOutcome,
  type EndOfTurnHealthPresentationInput,
  type EndOfTurnLeftRailInput,
  type HealthResolutionPresentationTrigger,
} from './gameSession/clienteffects/useEndOfTurnPresentation';
import { useDestroyTargetingRuntime } from './gameSession/destroyTargeting';
import {
  deriveAncientSolarDisplayEntries,
  isLiveRowAncientSolarPowerId,
} from './gameSession/ancientSolarDisplay';
import {
  allocateNextAncientBlackHoleTarget,
  allocateNextAncientSimulacrumTarget,
  buildAncientBlackHoleBoardTargeting,
  buildPersistentAncientSolarTargetMarkers,
  buildAncientSimulacrumBoardTargeting,
  deriveAncientBlackHoleDamagePreview,
  deriveAncientBlackHoleTargetingState,
  deriveAncientSimulacrumTargetingState,
  overlayAncientSolarTargetMarkers,
} from './gameSession/ancientSolarTargeting';
import { deriveAncientSolarHoverValues } from './gameSession/ancientSolarHoverValues';
import type {
  AcceptedFullStateFingerprint,
  AuthoritativeStateApplyMeta,
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
  BoardFleetSummary,
  BoardStatBreakdownRowVm,
  BoardViewModel,
  ChooseSpeciesBoardVm,
  ComputerBotSpeciesId,
  BottomActionRailViewModel,
  ActionPanelTabId,
  ActionPanelTabVm,
  ActionPanelViewModel,
  AncientCatalogueEnergyDisplay,
  BattleLogHistoryResponse,
  GameSessionChatEntry,
  GameSessionViewModel,
  GameSessionActions,
  FleetAreaHealthDeltaFlashVm,
  EvolverChoiceId,
  CentaurChargeSubTabId,
  BuildDrawingActionFamily,
  FirstStrikeActionFamily,
  GameStateClockSnapshot,
  GameStateRequestMeta,
  TurnPhaseMilestoneId,
  TurnPhasePresentationVm,
  TurnPhaseVm,
} from './gameSession/types';

export type {
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
  BoardFleetSummary,
  BoardStatBreakdownRowVm,
  BoardViewModel,
  ChooseSpeciesBoardVm,
  ComputerBotSpeciesId,
  BottomActionRailViewModel,
  ActionPanelTabId,
  ActionPanelTabVm,
  ActionPanelViewModel,
  GameSessionViewModel,
  GameSessionActions,
  FleetAreaHealthDeltaFlashVm,
  CentaurChargeSubTabId,
  TurnPhaseMilestoneId,
  TurnPhasePresentationVm,
  TurnPhaseVm,
} from './gameSession/types';
import { useTurnPhasePresentation } from './gameSession/clienteffects/useTurnPhasePresentation';

import {
  type BuildDrawingRouteRequest,
  classifyRenderableFirstStrikeActions,
  decideAutoPanelRouting,
  FIRST_STRIKE_MANDATORY_FAMILIES,
  getDefaultChoiceIdForRenderableAction,
  getFirstStrikePanelIdForFamily,
  getRenderableActionShipPresence,
  getRenderableActionChoiceIds,
  getRenderableServerChoiceActions,
  getSelectedChoiceIdForRenderableAction,
  isDeferredAutoPanelHandoffPhase,
  isCataloguePanel,
  isRenderableTargetedAction,
  isRenderableTargetedActionComplete,
  orderFirstStrikeFamilies,
  speciesToCataloguePanelId,
} from './gameSession/availableActions';
import { buildMessageAction } from './gameSession/powerIntents';
import {
  ANCIENT_BLACK_HOLE_PREVIEW_COST,
  ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID,
  buildAncientChargeDeclarationPayload,
  canAffordAncientEnergyCost,
  deriveAncientBlackHoleCastability,
  deriveAncientAutocastEntryDecision,
  deriveAncientChargeDeclarationInitialStage,
  deriveAncientManualSolarCastability,
  deriveAncientSimulacrumSelectorState,
  deriveAncientSiphonSelectorState,
  getAncientChargeDeclarationActions,
  getAncientEnergyTotal,
  getUsableAncientEnergyPoolForPlayer,
  isFixedAncientManualSolarPowerId,
  replayAncientManualSolarCasts,
  selectAncientSolarPresentationCasts,
  snapshotAncientManualSolarCastsForPresentation,
  type AncientChargeDeclarationWorkflow,
  type AncientManualSolarCast,
  type AncientSolarSelectorMode,
  type FrozenAncientChargeDeclarationAttempt,
  type FixedAncientManualSolarPowerId,
} from './gameSession/ancientChargeDeclaration';
import {
  ANCIENT_SIPHON_MINIMUM_SPEND,
  isValidAncientSiphonSpend,
} from '../data/ancientSiphonRules';
// ============================================================================

// ============================================================================
// HOOK
// ============================================================================

interface UseGameSessionOptions {
  boardFlashEnabled?: boolean;
  onNavigateToGame?: (gameId: string) => void;
}

type PendingSpeciesConfirmation = {
  requestId: number;
  entryKey: string;
  submittedSpecies: SpeciesId;
  submittedBotSpecies: ComputerBotSpeciesId | null;
  isComputerGame: boolean;
};

const EMPTY_BUILD_PREVIEW_COUNTS: Record<string, number> = {};

function normalizeBoardStatBreakdownRows(rawRows: unknown): BoardStatBreakdownRowVm[] {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows.flatMap((row): BoardStatBreakdownRowVm[] => {
    if (!row || typeof row !== 'object') {
      return [];
    }

    const rawRecord = row as Record<string, unknown>;
    const label = typeof rawRecord.label === 'string' ? rawRecord.label : '';
    const amount = typeof rawRecord.amount === 'number' ? rawRecord.amount : 0;
    const amountText = typeof rawRecord.amountText === 'string' ? rawRecord.amountText : String(amount);
    const count = typeof rawRecord.count === 'number' ? rawRecord.count : undefined;

    if (!label || amount === 0) {
      return [];
    }

    if (rawRecord.rowKind === 'solar_power') {
      if (
        !isLiveRowAncientSolarPowerId(rawRecord.solarPowerId) ||
        typeof count !== 'number' ||
        !Number.isInteger(count) ||
        count <= 0
      ) {
        return [];
      }

      return [{
        rowKind: 'solar_power',
        solarPowerId: rawRecord.solarPowerId,
        label,
        count,
        amount,
        amountText,
      }];
    }

    if (rawRecord.rowKind === 'adjustment') {
      return [{
        rowKind: 'adjustment',
        label,
        amount,
        amountText,
      }];
    }

    return [{
      rowKind: 'ship',
      label,
      count,
      amount,
      amountText,
    }];
  });
}

type OwnFiniteNumberRead =
  | { present: true; value: number }
  | { present: false };

type OwnBuildEconomyRead =
  | { present: true; value: any }
  | { present: false };

type BuildDrawingEconomyContinuity = {
  phaseInstanceKey: string;
  economy: any;
};

type CommittedDrawingProjection = {
  key: string;
  ordinary: number;
  joining: number;
};

type MixedFirstStrikeHandoffState = {
  phaseInstanceKey: string;
  orderedFamilies: FirstStrikeActionFamily[];
  activeFamily: FirstStrikeActionFamily | null;
};

type HealthPresentationBuildResult = {
  trigger: HealthResolutionPresentationTrigger;
  boardOverride: {
    signature: string;
    resolvedTurnKey: string;
    responseTurnNumber: number;
    responseIsFinished: boolean;
    myHealth: number;
    opponentHealth: number;
    myMaxHealth: number;
    opponentMaxHealth: number;
    myLastTurnHeal: number;
    myLastTurnDamage: number;
    myLastTurnNet: number;
    opponentLastTurnHeal: number;
    opponentLastTurnDamage: number;
    opponentLastTurnNet: number;
  };
};

const DEFAULT_MAX_HEALTH = 35;

function readExplicitProjectedMaxHealth(value: unknown): OwnFiniteNumberRead {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? { present: true, value }
    : { present: false };
}

function normalizeProjectedMaxHealth(value: unknown): number {
  const projectedMaxHealth = readExplicitProjectedMaxHealth(value);
  return projectedMaxHealth.present ? projectedMaxHealth.value : DEFAULT_MAX_HEALTH;
}

function hasOwnRecordKey(value: unknown, key: string): boolean {
  return value != null && Object.prototype.hasOwnProperty.call(Object(value), key);
}

function readOwnFiniteNumber(map: unknown, playerId: string | null | undefined): OwnFiniteNumberRead {
  if (!playerId || !map || typeof map !== 'object' || Array.isArray(map)) {
    return { present: false };
  }

  const record = map as Record<string, unknown>;
  if (!hasOwnRecordKey(record, playerId)) {
    return { present: false };
  }

  const value = record[playerId];
  return typeof value === 'number' && Number.isFinite(value)
    ? { present: true, value }
    : { present: false };
}

function readBuildEconomyForPlayer(state: any, playerId: string | null | undefined): OwnBuildEconomyRead {
  if (!playerId) {
    return { present: false };
  }

  const requester = state?.requester;
  if (
    hasOwnRecordKey(requester, 'buildEconomy') &&
    requester?.playerId === playerId
  ) {
    return { present: true, value: requester.buildEconomy };
  }

  const requesterBuildEconomyByPlayerId = hasOwnRecordKey(requester, 'buildEconomyByPlayerId')
    ? requester.buildEconomyByPlayerId
    : undefined;
  if (
    requesterBuildEconomyByPlayerId &&
    typeof requesterBuildEconomyByPlayerId === 'object' &&
    hasOwnRecordKey(requesterBuildEconomyByPlayerId, playerId)
  ) {
    return {
      present: true,
      value: (requesterBuildEconomyByPlayerId as Record<string, unknown>)[playerId],
    };
  }

  const buildEconomyByPlayerId = hasOwnRecordKey(state, 'buildEconomyByPlayerId')
    ? state.buildEconomyByPlayerId
    : undefined;
  if (
    buildEconomyByPlayerId &&
    typeof buildEconomyByPlayerId === 'object' &&
    hasOwnRecordKey(buildEconomyByPlayerId, playerId)
  ) {
    return {
      present: true,
      value: (buildEconomyByPlayerId as Record<string, unknown>)[playerId],
    };
  }

  return { present: false };
}

function normalizeBuildEconomyForDisplay(value: unknown): any | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const ordinaryLinesAvailable = record.ordinaryLinesAvailable;
  const joiningLinesAvailable = record.joiningLinesAvailable;

  if (
    typeof ordinaryLinesAvailable !== 'number' ||
    !Number.isFinite(ordinaryLinesAvailable) ||
    typeof joiningLinesAvailable !== 'number' ||
    !Number.isFinite(joiningLinesAvailable)
  ) {
    return null;
  }

  return {
    ...record,
    ordinaryLinesAvailable,
    joiningLinesAvailable,
  };
}

function sumBoardStatBreakdownRows(rows: BoardStatBreakdownRowVm[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

function normalizeFrigateTriggerSelection(value: unknown): number {
  let triggerNumber = Number(value);

  if (!Number.isFinite(triggerNumber)) {
    triggerNumber = 1;
  }

  return Math.max(1, Math.min(6, Math.floor(triggerNumber)));
}

function buildDraftPreviewFrigateTriggerByRowId(
  turnNumber: number,
  selections: number[]
): Record<string, number> {
  const previewRowIds = getDraftPreviewFrigateRowIds(turnNumber, selections.length);
  const triggerByRowId: Record<string, number> = {};

  previewRowIds.forEach((rowId, index) => {
    triggerByRowId[rowId] = normalizeFrigateTriggerSelection(selections[index]);
  });

  return triggerByRowId;
}

function normalizeQuantumMysticSelection(value: unknown): number {
  let selectedNumber = Number(value);

  if (!Number.isFinite(selectedNumber)) {
    selectedNumber = 1;
  }

  return Math.max(1, Math.min(6, Math.floor(selectedNumber)));
}

function buildDraftPreviewQuantumMysticNumberByRowId(
  turnNumber: number,
  selections: number[]
): Record<string, number> {
  const previewRowIds = getDraftPreviewQuantumMysticRowIds(turnNumber, selections.length);
  const numberByRowId: Record<string, number> = {};

  previewRowIds.forEach((rowId, index) => {
    numberByRowId[rowId] = normalizeQuantumMysticSelection(selections[index]);
  });

  return numberByRowId;
}

function isBattleLogTurnPlayerSummary(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.playerId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.healthEnd === 'number' &&
    typeof record.healthDelta === 'number' &&
    typeof record.fleetValueEnd === 'number' &&
    Number.isFinite(record.fleetValueEnd)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isBattleLogAnalysisBreakdownRow(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.label !== 'string' ||
    record.label.trim().length <= 0 ||
    typeof record.amount !== 'number' ||
    !Number.isFinite(record.amount) ||
    record.amount === 0
  ) {
    return false;
  }

  if (record.rowKind === 'solar_power') {
    return (
      isLiveRowAncientSolarPowerId(record.solarPowerId) &&
      typeof record.count === 'number' &&
      Number.isInteger(record.count) &&
      record.count > 0
    );
  }

  if (record.rowKind === 'ship') {
    return (
      record.solarPowerId === undefined &&
      (
        record.count === undefined ||
        (
          typeof record.count === 'number' &&
          Number.isInteger(record.count) &&
          record.count > 0
        )
      )
    );
  }

  return (
    record.rowKind === 'adjustment' &&
    record.solarPowerId === undefined &&
    record.count === undefined
  );
}

function isBattleLogTurnPlayerAnalysis(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.damageTaken !== 'number' ||
    !Number.isFinite(record.damageTaken) ||
    typeof record.healReceived !== 'number' ||
    !Number.isFinite(record.healReceived) ||
    typeof record.netHealthDelta !== 'number' ||
    !Number.isFinite(record.netHealthDelta) ||
    typeof record.savedLinesEnd !== 'number' ||
    !Number.isFinite(record.savedLinesEnd) ||
    typeof record.savedJoiningLinesEnd !== 'number' ||
    !Number.isFinite(record.savedJoiningLinesEnd)
  ) {
    return false;
  }

  return (
    (record.damageDealtBreakdown === undefined ||
      (Array.isArray(record.damageDealtBreakdown) &&
        record.damageDealtBreakdown.every(isBattleLogAnalysisBreakdownRow))) &&
    (record.healingReceivedBreakdown === undefined ||
      (Array.isArray(record.healingReceivedBreakdown) &&
        record.healingReceivedBreakdown.every(isBattleLogAnalysisBreakdownRow)))
  );
}

function isBattleLogHistoryResponse(value: unknown): value is BattleLogHistoryResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.gameId !== 'string' ||
    typeof record.revision !== 'number' ||
    typeof record.completedTurnCount !== 'number' ||
    !Array.isArray(record.turns)
  ) {
    return false;
  }

  return record.turns.every((turn) => {
    if (!turn || typeof turn !== 'object') {
      return false;
    }

    const turnRecord = turn as Record<string, unknown>;
    if (
      typeof turnRecord.turnNumber !== 'number' ||
      (turnRecord.diceValue !== null && typeof turnRecord.diceValue !== 'number') ||
      !Array.isArray(turnRecord.players)
    ) {
      return false;
    }

    const buildLinesByPlayerId = turnRecord.buildLinesByPlayerId;
    const battleLinesByPlayerId = turnRecord.battleLinesByPlayerId;
    if (
      !buildLinesByPlayerId ||
      typeof buildLinesByPlayerId !== 'object' ||
      !battleLinesByPlayerId ||
      typeof battleLinesByPlayerId !== 'object'
    ) {
      return false;
    }

    return (
      turnRecord.players.every(isBattleLogTurnPlayerSummary) &&
      Object.values(buildLinesByPlayerId as Record<string, unknown>).every(isStringArray) &&
      Object.values(battleLinesByPlayerId as Record<string, unknown>).every(isStringArray) &&
      (turnRecord.analysisByPlayerId === undefined ||
        (
          typeof turnRecord.analysisByPlayerId === 'object' &&
          turnRecord.analysisByPlayerId !== null &&
          Object.values(turnRecord.analysisByPlayerId as Record<string, unknown>).every(
            isBattleLogTurnPlayerAnalysis,
          )
        ))
    );
  });
}

function getAuthoritativeStateRevision(state: any): number {
  const stateRevision = state?.stateRevision;
  return Number.isInteger(stateRevision) && stateRevision > 0
    ? stateRevision
    : 1;
}

function extractAcceptedFullStateFingerprint(state: any): AcceptedFullStateFingerprint {
  return {
    stateRevision: getAuthoritativeStateRevision(state),
    status: getGameStatus(state),
    turnNumber: getTurnNumber(state),
    phaseKey: getPhaseKey(state),
  };
}

function isPlausibleGameStatePayload(
  value: unknown,
  expectedGameId: string | null
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.gameId !== 'string') {
    return false;
  }

  return expectedGameId == null || record.gameId === expectedGameId;
}

export function useGameSession(
  gameId: string,
  propsPlayerName: string,
  options: UseGameSessionOptions = {}
) {
  const boardFlashEnabled = options.boardFlashEnabled ?? true;

  // Stop /game-state polling once an authoritative finished payload has been stored.
  const POSTGAME_POLL_MS = 0;
  
  // ============================================================================
  // EFFECTIVE PLAYER NAME RESOLUTION
  // ============================================================================
  
  // Resolve effectivePlayerName with priority order:
  // 1. props.playerName (if provided by dashboard launcher)
  // 2. localStorage stored name (key: ss_playerName)
  // 3. Generate random friendly name and store to localStorage
  const effectivePlayerName = getPlayerName(propsPlayerName);
  
  // ============================================================================
  // EFFECTIVE GAMEID RESOLUTION (Part B: Deep link support)
  // ============================================================================
  
  // Resolve effectiveGameId with priority order:
  // 1. props.gameId (dashboard launcher path)
  // 2. URL query param ?game=... (deep link)
  // 3. URL query param ?gameId=... (legacy support)
  // 4. Otherwise: null
  
  const effectiveGameId = (() => {
    // Priority 1: Props gameId (truthy check)
    if (gameId && gameId !== 'demo_game') {
      return gameId;
    }
    
    // Priority 2 & 3: URL params
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('game') || params.get('gameId');
    
    if (urlGameId) {
      return urlGameId;
    }
    
    // No gameId available
    return null;
  })();
  
  // ============================================================================
  // CHUNK 9.1: NULL GAMEID GUARD (DEMO_GAME BOOTSTRAP SAFETY)
  // ============================================================================
  
  // NOTE: Bootstrap VM/actions construction moved to end of hook to comply with Rules of Hooks.
  // All hooks must be called unconditionally; early return removed.
  // See final return statement for bootstrap logic.
  
  // Server state
  const [rawState, setRawState] = useState<any>(null);
  const rawStateRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeSyncLocked, setResumeSyncLocked] = useState(false);
  const resumeSyncLockedRef = useRef(false);
  const lastHandledResumeSyncTokenRef = useRef<number | null>(null);
  const resumeLockActivationRequestSeqRef = useRef(0);
  const latestStartedGameStateRequestSeqRef = useRef(0);
  const latestAppliedGameStateRequestSeqRef = useRef(0);
  const lastImmediateRetrySourceRequestSeqRef = useRef<number | null>(null);
  const activeGameStateRequestSeqsRef = useRef<Set<number>>(new Set());
  const lastAcceptedFullFingerprintRef = useRef<AcceptedFullStateFingerprint | null>(null);
  const lastAcceptedFullSyncAtMsRef = useRef(0);
  
  // Chat state (separate from game state)
  const [chatEntries, setChatEntries] = useState<GameSessionChatEntry[]>([]);
  const [battleLogHistory, setBattleLogHistory] = useState<BattleLogHistoryResponse | null>(null);
  const battleLogHistoryRequestSeqRef = useRef(0);
  const lastBattleLogFetchGameIdRef = useRef<string | null>(null);
  const lastBattleLogFetchTurnNumberRef = useRef<number | null>(null);
  const lastBattleLogFetchFinishedRef = useRef(false);
  const isBattleLogHistoryAliveRef = useRef(true);
  const lastChatEntrySignatureRef = useRef<string | null>(null);
  const hasLoadedChatEntriesRef = useRef(false);
  const chatBurstUntilRef = useRef(0);
  const chatPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNextChatPollRef = useRef<((delayMs?: number) => void) | null>(null);
  const currentChatGameIdRef = useRef<string | null>(effectiveGameId);
  const isChatAliveRef = useRef(true);
  
  // Client-only active panel tracking
  const [activePanelId, setActivePanelId] = useState<ActionPanelId>('ap.catalog.ships.human');
  const [centaurChargeSubTabByPhaseInstanceKey, setCentaurChargeSubTabByPhaseInstanceKey] =
    useState<Record<string, CentaurChargeSubTabId>>({});
  const [buildDrawingFamilyByPhaseInstanceKey, setBuildDrawingFamilyByPhaseInstanceKey] =
    useState<Record<string, BuildDrawingActionFamily>>({});
  const [mixedFirstStrikeHandoffState, setMixedFirstStrikeHandoffState] =
    useState<MixedFirstStrikeHandoffState | null>(null);
  const lastPresentedBattleRevealTurnRef = useRef<number | null>(null);
  const seededBattleRevealGameIdRef = useRef<string | null>(null);
  const displayContinuityIdentityKeyRef = useRef<string | null>(null);
  const displayLineContinuityRef = useRef<Record<string, number>>({});
  const buildDrawingEconomyContinuityRef =
    useRef<BuildDrawingEconomyContinuity | null>(null);
  const committedDrawingProjectionRef = useRef<CommittedDrawingProjection | null>(null);

  function setResumeSyncLockedState(nextValue: boolean): void {
    resumeSyncLockedRef.current = nextValue;
    setResumeSyncLocked(nextValue);
  }

  function beginGameStateRequest(options?: { unlockEligible?: boolean }): GameStateRequestMeta {
    latestStartedGameStateRequestSeqRef.current += 1;
    activeGameStateRequestSeqsRef.current.add(latestStartedGameStateRequestSeqRef.current);

    const unlockEligible = options?.unlockEligible === true;

    return {
      requestSeq: latestStartedGameStateRequestSeqRef.current,
      unlockEligible,
      resumeLockActivationRequestSeq: unlockEligible
        ? resumeLockActivationRequestSeqRef.current
        : null,
    };
  }

  const finishGameStateRequest = useCallback((requestSeq: number): void => {
    activeGameStateRequestSeqsRef.current.delete(requestSeq);
  }, []);

  function shouldRetryGameStateRequestImmediately(requestMeta: GameStateRequestMeta): boolean {
    if (!resumeSyncLockedRef.current || requestMeta.unlockEligible !== true) {
      return false;
    }

    const requestActivationRequestSeq = requestMeta.resumeLockActivationRequestSeq;
    if (typeof requestActivationRequestSeq !== 'number') {
      return false;
    }

    if (requestActivationRequestSeq !== resumeLockActivationRequestSeqRef.current) {
      return false;
    }

    if (requestMeta.requestSeq <= requestActivationRequestSeq) {
      return false;
    }

    if (lastImmediateRetrySourceRequestSeqRef.current === requestMeta.requestSeq) {
      return false;
    }

    lastImmediateRetrySourceRequestSeqRef.current = requestMeta.requestSeq;
    return true;
  }

  function maybeUnlockResumeSyncFromGameStateSuccess(
    payload: unknown,
    requestMeta: GameStateRequestMeta
  ): void {
    if (!resumeSyncLockedRef.current || requestMeta.unlockEligible !== true) {
      return;
    }

    if (!isPlausibleGameStatePayload(payload, effectiveGameId)) {
      return;
    }

    const requestActivationRequestSeq = requestMeta.resumeLockActivationRequestSeq;
    if (typeof requestActivationRequestSeq !== 'number') {
      return;
    }

    if (requestActivationRequestSeq !== resumeLockActivationRequestSeqRef.current) {
      return;
    }

    if (requestMeta.requestSeq <= requestActivationRequestSeq) {
      return;
    }

    setResumeSyncLockedState(false);
  }

  function applyAuthoritativeRawState(
    nextState: any,
    meta: AuthoritativeStateApplyMeta
  ): boolean {
    if (meta.source !== 'game_state') {
      console.warn(`[useGameSession] Ignoring unsupported authoritative state source: ${meta.source}`);
      return false;
    }

    const requestSeq = meta.requestSeq;

    if (typeof requestSeq !== 'number') {
      console.warn('[useGameSession] Ignoring /game-state response without requestSeq metadata');
      return false;
    }

    const latestStartedRequestSeq = latestStartedGameStateRequestSeqRef.current;
    if (requestSeq !== latestStartedRequestSeq) {
      console.log(
        `[useGameSession] Ignoring stale /game-state response requestSeq=${requestSeq} latestStarted=${latestStartedRequestSeq}`
      );
      return false;
    }

    latestAppliedGameStateRequestSeqRef.current = requestSeq;

    rawStateRef.current = nextState;
    lastAcceptedFullFingerprintRef.current = extractAcceptedFullStateFingerprint(nextState);
    lastAcceptedFullSyncAtMsRef.current = Date.now();
    setRawState(nextState);
    return true;
  }

  useEffect(() => {
    rawStateRef.current = rawState;
  }, [rawState]);

  useEffect(() => {
    setPresentedOpponentRevealBlurSeq(0);
    lastPresentedBattleRevealTurnRef.current = null;
    seededBattleRevealGameIdRef.current = null;
  }, [effectiveGameId]);

  useEffect(() => {
    isBattleLogHistoryAliveRef.current = true;
    isChatAliveRef.current = true;

    return () => {
      isBattleLogHistoryAliveRef.current = false;
      battleLogHistoryRequestSeqRef.current += 1;
      isChatAliveRef.current = false;
      scheduleNextChatPollRef.current = null;
      if (chatPollTimerRef.current) {
        clearTimeout(chatPollTimerRef.current);
        chatPollTimerRef.current = null;
      }
    };
  }, []);

  // One-shot build.drawing routing request that survives until the routing effect consumes it.
  const [buildDrawingRouteRequest, setBuildDrawingRouteRequest] =
    useState<BuildDrawingRouteRequest>(null);
  const prevPhaseKeyRef = useRef<string | null>(null);
  const prevFrigateDemandCountRef = useRef(0);
  const prevQuantumMysticDemandCountRef = useRef(0);
  const prevEvolverRowIdsRef = useRef<Set<string>>(new Set());
  const finishedRedirectHandledGameIdRef = useRef<string | null>(null);
  const lastSpeciesSelectionEntryKeyRef = useRef<string | null>(null);
  const deferredHandoffAutoOpenEntryKeyRef = useRef<string | null>(null);
  const lastDeferredHandoffEntryKeyRef = useRef<string | null>(null);

  
  // Choose species state (client-only for now)
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId>('human');
  const [selectedBotSpecies, setSelectedBotSpecies] = useState<ComputerBotSpeciesId>('human');
  const [pendingSpeciesConfirmation, setPendingSpeciesConfirmation] =
    useState<PendingSpeciesConfirmation | null>(null);
  const speciesConfirmationGuardRef = useRef<number | null>(null);
  const speciesConfirmationRequestIdRef = useRef(0);
  const [boardMode, setBoardMode] = useState<BoardViewModel['mode']>('board');
  
  // ============================================================================
  // CLOCK INTERPOLATION STATE (DISPLAY-ONLY, NON-AUTHORITATIVE)
  // ============================================================================
  
  // Store last server clock snapshot for interpolation
  const lastClockRef = useRef<{
    serverNowMs: number;
    remainingMsByPlayerId: Record<string, number>;
    clocksAreLive: boolean;
  } | null>(null);
  
  // Previous rendered fleets are runtime-owned so pure helpers can reconcile the next frame.
  const prevMyRenderedFleetRef = useRef<BoardFleetSummary[]>([]);
  const prevOpponentRenderedFleetRef = useRef<BoardFleetSummary[]>([]);
  const prevShouldShowPreviewRef = useRef(false);
  const lastCommittedPreviewRenderedMyFleetRef = useRef<BoardFleetSummary[]>([]);
  
  // Tick driver for smooth clock display (forces rerenders)
  const [clockTick, setClockTick] = useState(0);

  const applyHeadClockSnapshot = useCallback((clockSnapshot: GameStateClockSnapshot | null): void => {
    if (!clockSnapshot) {
      return;
    }

    lastClockRef.current = clockSnapshot;
    setClockTick((tick) => tick + 1);
  }, []);

  const getLastAcceptedFullFingerprint = useCallback(
    (): AcceptedFullStateFingerprint | null => lastAcceptedFullFingerprintRef.current,
    [],
  );

  const getLastAcceptedFullSyncAtMs = useCallback(
    (): number => lastAcceptedFullSyncAtMsRef.current,
    [],
  );

  const hasAcceptedFullGameState = useCallback(
    (): boolean => lastAcceptedFullFingerprintRef.current != null,
    [],
  );

  const isGameStateRequestInFlight = useCallback(
    (): boolean => activeGameStateRequestSeqsRef.current.size > 0,
    [],
  );
  
  // ============================================================================
  // CHUNK 6: LOCAL BUILD PREVIEW BUFFER (NON-AUTHORITATIVE)
  // ============================================================================
  
  // Local preview buffer for build.drawing phase
  // Simple count map: { DEF: 2, FIG: 1, ... }
  // Reset when phase changes away from build.drawing
  const [buildPreviewCounts, setBuildPreviewCounts] = useState<Record<string, number>>({});
  const [buildPreviewTurnNumber, setBuildPreviewTurnNumber] = useState<number | null>(null);
  

  // Frigate trigger selections for Frigates built THIS TURN (ordered list, length = buildPreviewCounts.FRI)
  const [frigateSelectedTriggers, setFrigateSelectedTriggers] = useState<number[]>([]);
  const frigateSelectedTriggersRef = useRef<number[]>([]);
  const frigatePreviewTriggerByRowIdRef = useRef<Record<string, number>>({});
  const [quantumMysticSelectedNumbers, setQuantumMysticSelectedNumbers] = useState<number[]>([]);
  const quantumMysticSelectedNumbersRef = useRef<number[]>([]);
  const quantumMysticPreviewNumberByRowIdRef = useRef<Record<string, number>>({});
  const [evolverChoicesByRowId, setEvolverChoicesByRowId] = useState<Record<string, EvolverChoiceId>>({});
  const evolverChoicesByRowIdRef = useRef<Record<string, EvolverChoiceId>>({});
  // Ref-backed draft buffer: authoritative source for BUILD_SUBMIT payload
  // Prevents race condition when Ready is clicked immediately after building
  const buildPreviewCountsRef = useRef<Record<string, number>>({});
  const buildPreviewTurnNumberRef = useRef<number | null>(null);
  
  // Build submitted tracking: maps turnNumber → submitted flag
  // Used to gate ship clicks after submission
  const [buildSubmittedByTurn, setBuildSubmittedByTurn] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setBuildSubmittedByTurn({});
  }, [effectiveGameId]);
  
  // Reveal-sync latch: true when BUILD_REVEAL submitted but server fleet not yet updated
  // Prevents flicker by keeping preview overlay active until server catches up
  const [awaitingBuildRevealSync, setAwaitingBuildRevealSync] = useState(false);
  
  // ============================================================================
  // SHIP ANIMATION TOKENS (moved to gameSession/clienteffects/useFleetAnimTokens)
  // ============================================================================

  // POLL GATING STATE (Part A: State-based gating to trigger re-renders)
  // ============================================================================
  
  // Track if we've successfully joined the current game (gates polling)
  const [hasJoinedCurrentGame, setHasJoinedCurrentGame] = useState(false);
  
  // Store sessionId to detect "me" in polled state (for role checking)
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  
  // Part B: Canonical role state (confirmed from polled game-state)
  const [myRole, setMyRole] = useState<'player' | 'spectator' | 'unknown'>('unknown');
  
  // Reset join state when gameId changes
  useEffect(() => {
    setHasJoinedCurrentGame(false);
    setMyRole('unknown'); // Reset role when switching games
  }, [effectiveGameId]);

  useEffect(() => {
    finishedRedirectHandledGameIdRef.current = null;
  }, [effectiveGameId]);

  useEffect(() => {
    setBattleLogHistory(null);
    battleLogHistoryRequestSeqRef.current += 1;
    lastBattleLogFetchGameIdRef.current = null;
    lastBattleLogFetchTurnNumberRef.current = null;
    lastBattleLogFetchFinishedRef.current = false;
    currentChatGameIdRef.current = effectiveGameId;
    lastChatEntrySignatureRef.current = null;
    hasLoadedChatEntriesRef.current = false;
    chatBurstUntilRef.current = 0;
  }, [effectiveGameId]);

  // ============================================================================
  // LOCAL COMPLETION TRACKING (Chunk 4: Species selection wiring)
  // ============================================================================
  
  // Track completion by phase instance key: ${turnNumber}::${phaseKey}
  // In-memory only - resets on refresh (acceptable for Phase 1)
  const [speciesCommitDoneByPhase, setSpeciesCommitDoneByPhase] = useState<Record<string, boolean>>({});
  const [speciesRevealDoneByPhase, setSpeciesRevealDoneByPhase] = useState<Record<string, boolean>>({});
  
  // Species commit cache (payload + nonce storage with ref-backed same-tick reliability)
  const speciesCommitCache = usePhaseCommitCache<{ species: SpeciesId; botSpecies?: ComputerBotSpeciesId }>();
  
  // ============================================================================
  // LOCAL COMPLETION TRACKING (Chunk 7: Build commit/reveal)
  // ============================================================================
  
  // Track build submission by phase instance key
  const [buildCommitDoneByPhase, setBuildCommitDoneByPhase] = useState<Record<string, boolean>>({});
  const [buildRevealDoneByPhase, setBuildRevealDoneByPhase] = useState<Record<string, boolean>>({});
  
  // Build commit cache (payload + nonce storage with ref-backed same-tick reliability)
  const buildCommitCache = usePhaseCommitCache<CanonicalBuildSubmitPayload>();
  
  // ============================================================================
  // READY UX STATE (CLIENT-ONLY UI TRACKING)
  // ============================================================================
  
  // Track per-phase ready UX state: explicit clicks + sending status
  // Used to show "SENDING..." while awaiting server response
  // and "WAITING..." when auto-readied with no actions
  const [readyUxByPhaseInstanceKey, setReadyUxByPhaseInstanceKey] = useState<
    Record<string, { clickedThisPhase: boolean; sendingNow: boolean }>
  >({});
  
  // Client-only dice roll sequence counter (increments on each DICE_ROLLED event)
  const [, setDiceRollSeq] = useState(0);
  const [presentedOpponentRevealBlurSeq, setPresentedOpponentRevealBlurSeq] = useState(0);
  const [healthResolutionPresentationTrigger, setHealthResolutionPresentationTrigger] =
    useState<HealthResolutionPresentationTrigger | null>(null);
  const [healthPresentationBoardOverride, setHealthPresentationBoardOverride] =
    useState<HealthPresentationBuildResult['boardOverride'] | null>(null);
  const publishedHealthPresentationIdentitiesRef = useRef<Set<string>>(new Set());
  const previousObservedHealthResolutionRef = useRef<{
    gameId: string | null;
    turnNumber: number;
    isFinished: boolean;
  } | null>(null);
  const [publicMultiChargeByPlayerId, setPublicMultiChargeByPlayerId] =
    useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    setPublicMultiChargeByPlayerId({});
    setHealthResolutionPresentationTrigger(null);
    setHealthPresentationBoardOverride(null);
    publishedHealthPresentationIdentitiesRef.current.clear();
    previousObservedHealthResolutionRef.current = null;
  }, [effectiveGameId]);
  
  // ============================================================================
  // EVENT TAPE (Chunk 2: Dev-only plumbing)
  // ============================================================================
  
  // Event tape: client-only event log, reset on refresh
  const [eventTape, setEventTape] = useState<any[]>([]);
  
  // Track if we've shown the finished marker (one-time only)
  const finishedMarkerShownRef = useRef(false);
  
  // Track last seen phase/turn for poll markers
  const lastSeenRef = useRef<{ turn?: number; phaseKey?: string }>({});
  
  // ============================================================================
  // AUTO-JOIN TRACKING (Part C: Set-based tracking per gameId)
  // ============================================================================
  
  // Track auto-join attempts by gameId (allows new attempt when gameId changes)
  const attemptedJoinForGameRef = useRef<Set<string>>(new Set());
  
  // ============================================================================
  // TASK B: TURN-SCOPED AUTO BUILD_REVEAL TRACKING
  // ============================================================================
  
  // Track which turnNumbers have already had auto-reveal submitted
  // Prevents duplicate auto-reveal attempts for the same turn (fixes BAD_TURN spam)
  const autoBuildRevealSubmittedTurnsRef = useRef<Set<number>>(new Set());
  
  // ============================================================================
  // DEV LOGGING: LOG EFFECTIVE NAMES/IDS ON CHANGE ONLY
  // ============================================================================
  
  // Log effectivePlayerName only when it changes
  useEffect(() => {
    console.log('[useGameSession] effectivePlayerName resolved:', effectivePlayerName, '(props:', propsPlayerName, ')');
  }, [effectivePlayerName, propsPlayerName]);
  
  // Log effectiveGameId only when it changes
  useEffect(() => {
    console.log('[useGameSession] effectiveGameId resolved:', effectiveGameId, '(props:', gameId, ')');
  }, [effectiveGameId, gameId]);
  
  // ============================================================================
  // AUTO-JOIN ON MOUNT (Chunk 3: Fire-and-forget join attempt)
  // ============================================================================
  
  useAutoJoinEffect({
    effectiveGameId,
    effectivePlayerName,
    attemptedJoinForGameRef,
    ensureSession,
    authenticatedPost,
    authenticatedGet,
    setMySessionId,
    setHasJoinedCurrentGame,
  });
  
  // ============================================================================
  // DEV EFFECTS: POLL MARKERS
  // ============================================================================
  
  usePollMarkerEffect({
    rawState,
    lastSeenRef,
    appendEventsToTape: (events, meta) => appendEventsToTape(setEventTape, events, meta),
    getTurnNumber,
    getPhaseKey,
  });
  
  // ============================================================================
  // CHUNK 8: END-OF-GAME LOCKOUT (SERVER AUTHORITATIVE) — DERIVED FLAGS
  // ============================================================================

  const {
    mode: untimedPollingMode,
    resumeToken: untimedResumeToken,
  } = useUntimedPollingThrottle();
  const isFinished = isGameFinished(rawState);
  const isUntimedAuthoritative =
    rawState?.gameData != null &&
    rawState.gameData.clock == null;
  const terminalWinnerPlayerId = getWinnerPlayerId(rawState);
  const terminalResultReason = getResultReason(rawState);

  useEffect(() => {
    setResumeSyncLockedState(false);
    lastHandledResumeSyncTokenRef.current = untimedResumeToken;
    resumeLockActivationRequestSeqRef.current = 0;
    latestStartedGameStateRequestSeqRef.current = 0;
    latestAppliedGameStateRequestSeqRef.current = 0;
    lastImmediateRetrySourceRequestSeqRef.current = null;
    activeGameStateRequestSeqsRef.current.clear();
    lastAcceptedFullFingerprintRef.current = null;
    lastAcceptedFullSyncAtMsRef.current = 0;
  }, [effectiveGameId]);

  useEffect(() => {
    if (lastHandledResumeSyncTokenRef.current === untimedResumeToken) {
      return;
    }

    lastHandledResumeSyncTokenRef.current = untimedResumeToken;

    if (rawState == null || !isUntimedAuthoritative) {
      return;
    }

    resumeLockActivationRequestSeqRef.current = latestStartedGameStateRequestSeqRef.current;
    lastImmediateRetrySourceRequestSeqRef.current = null;
    setResumeSyncLockedState(true);
  }, [isUntimedAuthoritative, rawState, untimedResumeToken]);

  // Keep result text minimal and TDZ-safe.
  // (Winner mapping can be added later, but do not depend on me/opponent here.)
  const finishedResultText = 'GAME OVER';
  
  // ============================================================================
  // LIVE POLLING (AFTER isFinished IS DERIVED)
  // ============================================================================
  
  usePollingEffect({
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    beginGameStateRequest,
    finishGameStateRequest,
    maybeUnlockResumeSyncFromGameStateSuccess,
    applyAuthoritativeRawState,
    shouldRetryGameStateRequestImmediately,
    isResumeSyncLocked: () => resumeSyncLockedRef.current,
    hasAcceptedFullGameState,
    getLastAcceptedFullFingerprint,
    getLastAcceptedFullSyncAtMs,
    isGameStateRequestInFlight,
    applyHeadClockSnapshot,
    setLoading,
    setError,
    isFinished,
    isUntimedAuthoritative,
    untimedPollingMode,
    untimedResumeToken,
    postGamePollMs: POSTGAME_POLL_MS,
  });

  const { extendChatBurstWindow, getNextChatPollDelayMs, fetchChatOnce } = useChatPolling({
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    setChatEntries,
    currentChatGameIdRef,
    isChatAliveRef,
    lastChatEntrySignatureRef,
    hasLoadedChatEntriesRef,
    chatBurstUntilRef,
    chatPollTimerRef,
    scheduleNextChatPollRef,
    isUntimedAuthoritative,
    untimedPollingMode,
    untimedResumeToken,
  });
  
  // ============================================================================
  // DEV EFFECTS: ONE-TIME GAME OVER MARKER
  // ============================================================================
  
  useFinishedMarkerEffect({
    isFinished,
    finishedResultText,
    rawState,
    finishedMarkerShownRef,
    appendEventsToTape: (events, meta) => appendEventsToTape(setEventTape, events, meta),
    getTurnNumber,
    getPhaseKey,
  });
  
  // ============================================================================
  // DEV EFFECTS: ROLE CHECK + JOIN OUTCOME LOGGING
  // ============================================================================
  
  useRoleCheckLoggingEffect({
    rawState,
    mySessionId,
    effectivePlayerName,
    setMyRole,
  });
  
  // ============================================================================
  // DEV EFFECTS: FULL PLAYER SNAPSHOT
  // ============================================================================
  
  usePlayersFullSnapshotEffect({ rawState });
  
  // ============================================================================
  // DEV EFFECTS: SPECTATOR COUNT DEBUG LOG
  // ============================================================================
  
  useSpectatorCountDebugEffect({ rawState, effectiveGameId });

  async function fetchBattleLogHistoryOnce(gameIdToFetch: string, requestSeq: number): Promise<void> {
    if (!gameIdToFetch) {
      return;
    }

    try {
      const response = await authenticatedGet(`/game-history/${gameIdToFetch}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[useGameSession] Battle log history fetch failed: ${response.status} ${errorText}`);
        return;
      }

      const data: unknown = await response.json();
      if (!isBattleLogHistoryResponse(data)) {
        console.warn('[useGameSession] Battle log history fetch returned invalid payload');
        return;
      }

      if (
        !isBattleLogHistoryAliveRef.current ||
        battleLogHistoryRequestSeqRef.current !== requestSeq ||
        effectiveGameId !== gameIdToFetch ||
        data.gameId !== gameIdToFetch
      ) {
        return;
      }

      setBattleLogHistory(data);
    } catch (err: any) {
      console.warn('[useGameSession] Battle log history fetch error:', err?.message ?? err);
    }
  }

  useEffect(() => {
    if (!effectiveGameId || !rawState) {
      return;
    }

    const authoritativeTurnNumber = getTurnNumber(rawState);
    const shouldFetchInitial =
      lastBattleLogFetchGameIdRef.current !== effectiveGameId;
    const shouldFetchTurnChange =
      !shouldFetchInitial &&
      lastBattleLogFetchTurnNumberRef.current !== authoritativeTurnNumber;
    const shouldFetchFinished =
      !shouldFetchInitial &&
      isFinished &&
      !lastBattleLogFetchFinishedRef.current;

    if (!shouldFetchInitial && !shouldFetchTurnChange && !shouldFetchFinished) {
      return;
    }

    lastBattleLogFetchGameIdRef.current = effectiveGameId;
    lastBattleLogFetchTurnNumberRef.current = authoritativeTurnNumber;
    lastBattleLogFetchFinishedRef.current = isFinished;

    battleLogHistoryRequestSeqRef.current += 1;
    const requestSeq = battleLogHistoryRequestSeqRef.current;
    fetchBattleLogHistoryOnce(effectiveGameId, requestSeq);
  }, [effectiveGameId, rawState, isFinished]);
  
  // ============================================================================
  // CHUNK 7: INTERNAL REFRESH HELPER
  // ============================================================================
  
  /**
   * Internal helper to refresh game state immediately (does NOT replace polling)
   * Used after build reveal and declare ready to pull fresh state faster
   */
  async function refreshGameStateOnce(options?: {
    unlockEligible?: boolean;
    allowImmediateRetry?: boolean;
  }): Promise<void> {
    const requestMeta = beginGameStateRequest({
      unlockEligible: options?.unlockEligible === true || resumeSyncLockedRef.current,
    });

    try {
      const response = await authenticatedGet(`/game-state/${effectiveGameId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[useGameSession] refreshGameStateOnce failed: ${response.status} ${errorText}`);

        const canRetryImmediately =
          options?.allowImmediateRetry !== false &&
          response.status !== 403 &&
          response.status !== 404 &&
          shouldRetryGameStateRequestImmediately(requestMeta);

        if (canRetryImmediately) {
          console.warn('[useGameSession] refreshGameStateOnce immediate retry after failed unlock-eligible request');
          await refreshGameStateOnce({
            unlockEligible: requestMeta.unlockEligible,
            allowImmediateRetry: false,
          });
        }

        return;
      }
      
      const data = await response.json();
      maybeUnlockResumeSyncFromGameStateSuccess(data, requestMeta);
      const accepted = applyAuthoritativeRawState(data, {
        source: 'game_state',
        requestSeq: requestMeta.requestSeq,
        unlockEligible: requestMeta.unlockEligible,
      });

      if (accepted) {
        console.log('[useGameSession] refreshGameStateOnce succeeded');
      } else {
        console.log('[useGameSession] refreshGameStateOnce ignored stale response');
      }
    } catch (err: any) {
      console.error('[useGameSession] refreshGameStateOnce error:', err.message);

      if (
        options?.allowImmediateRetry !== false &&
        shouldRetryGameStateRequestImmediately(requestMeta)
      ) {
        console.warn('[useGameSession] refreshGameStateOnce immediate retry after request error');
        await refreshGameStateOnce({
          unlockEligible: requestMeta.unlockEligible,
          allowImmediateRetry: false,
        });
      }
    } finally {
      finishGameStateRequest(requestMeta.requestSeq);
    }
  }
  
  /**
   * Submit intent wrapper (delegates to authenticatedPost)
   */
  async function submitIntent(body: any, timeoutMs?: number): Promise<Response> {
    return authenticatedPost('/intent', body, timeoutMs);
  }

  const phaseHoldHealthPresentationHandlerRef = useRef(handleIntentResultForHealthPresentation);
  phaseHoldHealthPresentationHandlerRef.current = handleIntentResultForHealthPresentation;

  const phaseHoldContinuationRuntimeRef = useRef({
    effectiveGameId: effectiveGameId as string | null,
    myRole,
    submitIntent,
    refreshGameStateOnce,
  });
  phaseHoldContinuationRuntimeRef.current = {
    effectiveGameId,
    myRole,
    submitIntent,
    refreshGameStateOnce,
  };

  const continueAuthoritativePhaseHold = useCallback(
    async (
      args: ContinueAuthoritativePhaseHoldArgs
    ): Promise<ContinueAuthoritativePhaseHoldOutcome> => {
      const runtime = phaseHoldContinuationRuntimeRef.current;
      const { holdSignature, holdTurnNumber } = args;

      if (!runtime.effectiveGameId || runtime.myRole === 'spectator') {
        return 'retry';
      }

      try {
        const response = await runtime.submitIntent({
          gameId: runtime.effectiveGameId,
          intentType: 'CONTINUE_PHASE_HOLD',
          turnNumber: holdTurnNumber,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useGameSession] CONTINUE_PHASE_HOLD failed:', response.status, errorText);
          await runtime.refreshGameStateOnce();
          return 'retry';
        }

        const result = await response.json();

        if (!result?.ok) {
          console.error(
            '[useGameSession] CONTINUE_PHASE_HOLD rejected:',
            result?.rejected?.code,
            result?.rejected?.message
          );
          await runtime.refreshGameStateOnce();
          return 'retry';
        }

        const returnedState = result?.state;
        const returnedPhaseHold = getPhaseHold(returnedState);
        const returnedPhaseHoldReason = returnedPhaseHold?.holdReason;
        const returnedPhaseHoldPhaseKey = returnedPhaseHold?.phaseKey;
        const returnedPhaseHoldIsContinuable =
          (
            returnedPhaseHoldPhaseKey === 'battle.end_of_turn_resolution' &&
            returnedPhaseHoldReason === 'end_of_turn_health'
          ) ||
          (
            returnedPhaseHoldPhaseKey === 'battle.reveal' &&
            returnedPhaseHoldReason === 'battle_reveal'
          );
        const returnedHoldSignature =
          returnedPhaseHold &&
          typeof returnedPhaseHold === 'object' &&
          returnedPhaseHoldIsContinuable &&
          typeof returnedPhaseHold.holdUntilMs === 'number'
            ? buildPhaseHoldSignature({
                gameId: runtime.effectiveGameId,
                turnNumber: getTurnNumber(returnedState),
                phaseKey: returnedPhaseHoldPhaseKey,
                holdReason: returnedPhaseHoldReason,
                holdUntilMs: returnedPhaseHold.holdUntilMs,
              })
            : null;
        const hasReturnedStateObject =
          returnedState != null &&
          typeof returnedState === 'object' &&
          !Array.isArray(returnedState);
        const outcome: ContinueAuthoritativePhaseHoldOutcome =
          !hasReturnedStateObject
            ? 'retry'
            : returnedHoldSignature === holdSignature
              ? 'still_holding'
              : 'released';

        phaseHoldHealthPresentationHandlerRef.current(result, {
          label: 'CONTINUE_PHASE_HOLD',
          turn: holdTurnNumber,
          phaseKey: returnedPhaseHoldPhaseKey,
        });
        void runtime.refreshGameStateOnce();

        return outcome;
      } catch (err: any) {
        console.error('[useGameSession] CONTINUE_PHASE_HOLD error:', err.message);
        await runtime.refreshGameStateOnce();
        return 'retry';
      }
    },
    []
  );

  function getLatestIntentContext() {
    const latestRawState = rawStateRef.current;
    const latestTurnNumber = latestRawState ? getTurnNumber(latestRawState) : turnNumber;

    return {
      gameId: effectiveGameId,
      turnNumber: latestTurnNumber,
    };
  }

  function getLatestAvailableActions() {
    const latestAvailableActions = getAvailableActions(rawStateRef.current);
    return Array.isArray(latestAvailableActions) ? latestAvailableActions : null;
  }

  async function submitMenuIntent(intentType: 'SURRENDER' | 'DRAW_OFFER' | 'DRAW_ACCEPT' | 'DRAW_REFUSE') {
    const latest = getLatestIntentContext();

    if (!latest.gameId) {
      console.error(`[useGameSession] ${intentType} blocked: missing gameId`);
      return;
    }

    try {
      const response = await submitIntent({
        gameId: latest.gameId,
        intentType,
        turnNumber: latest.turnNumber,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[useGameSession] ${intentType} failed:`, response.status, errorText);
        await refreshGameStateOnce();
        return;
      }

      const result = await response.json();

      if (!result.ok) {
        console.error(
          `[useGameSession] ${intentType} rejected:`,
          result.rejected?.code,
          result.rejected?.message
        );
        await refreshGameStateOnce();
        return;
      }

      appendEventsToTape(setEventTape, result.events ?? [], { label: intentType });
      await refreshGameStateOnce();
    } catch (err: any) {
      console.error(`[useGameSession] ${intentType} error:`, err.message);
      await refreshGameStateOnce();
    }
  }
  
  // ============================================================================
  // MAP LIVE STATE TO VIEW-MODELS
  // ============================================================================
  
  // ============================================================================
  // VIEWER / SEAT DERIVATION (AUTHORITATIVE - ME VS OPPONENT)
  // ============================================================================
  
  const viewerSeats = deriveViewerSeats(rawState, mySessionId);
  const {
    allPlayers,
    p1,
    p2,
    viewerMode,
    isViewerPlayer,
    isViewerSpectator,
    me,
    opponent,
    meReadyKey,
    opponentReadyKey,
  } = viewerSeats;

  // Presentation-only display seats. Authority paths must continue to use
  // the true viewer-relative `me` / `opponent` values above.
  const displayLeftPlayer = isViewerSpectator ? p1 : me;
  const displayRightPlayer = isViewerSpectator ? p2 : opponent;
  const displayLeftReadyKey = isViewerSpectator ? viewerSeats.p1ReadyKey : meReadyKey;
  const displayRightReadyKey = isViewerSpectator ? viewerSeats.p2ReadyKey : opponentReadyKey;
  const displayContinuityIdentityKey = JSON.stringify({
    gameId: effectiveGameId,
    session: mySessionId,
    viewerMode,
    isViewerSpectator,
    left: getPlayerIdentityKey(displayLeftPlayer),
    right: getPlayerIdentityKey(displayRightPlayer),
    leftReadyKey: displayLeftReadyKey,
    rightReadyKey: displayRightReadyKey,
    me: getPlayerIdentityKey(me),
    opponent: getPlayerIdentityKey(opponent),
  });
  const activationHardContinuityKey = JSON.stringify({
    gameId: effectiveGameId,
    session: mySessionId,
    viewerMode,
    viewerRole: myRole,
    left: getPlayerIdentityKey(displayLeftPlayer),
    right: getPlayerIdentityKey(displayRightPlayer),
    me: getPlayerIdentityKey(me),
    opponent: getPlayerIdentityKey(opponent),
  });

  if (displayContinuityIdentityKeyRef.current !== displayContinuityIdentityKey) {
    displayContinuityIdentityKeyRef.current = displayContinuityIdentityKey;
    displayLineContinuityRef.current = {};
    buildDrawingEconomyContinuityRef.current = null;
    committedDrawingProjectionRef.current = null;
  }
  
  // ============================================================================
  // GAME LOGIC - USE ME/OPPONENT (NOT LEFT/RIGHT)
  // ============================================================================
  
  // Phase data
  const phaseKey = rawState ? getPhaseKey(rawState) : 'unknown';
  const turnNumber = rawState ? getTurnNumber(rawState) : 1;
  const turnPhaseProgress = getPublicTurnPhaseProgress(rawState);
  const hasHydratedTurnNumber =
    rawState != null &&
    typeof turnNumber === 'number' &&
    Number.isFinite(turnNumber);
  const activeBuildPreviewCounts =
    hasHydratedTurnNumber && buildPreviewTurnNumber === turnNumber
      ? buildPreviewCounts
      : EMPTY_BUILD_PREVIEW_COUNTS;
  const getActiveBuildPreviewCountsRefForTurn = useCallback(
    (previewTurnNumber: number): Record<string, number> => {
      if (!hasHydratedTurnNumber || !Number.isFinite(previewTurnNumber)) {
        return EMPTY_BUILD_PREVIEW_COUNTS;
      }

      return buildPreviewTurnNumberRef.current === previewTurnNumber
        ? buildPreviewCountsRef.current
        : EMPTY_BUILD_PREVIEW_COUNTS;
    },
    [hasHydratedTurnNumber],
  );
  // Phase 3.x: server-authoritative actions availability (declare early to avoid TDZ)
  const availableActions = getAvailableActions(rawState);
  const hasServerActionsAvailable =
    Array.isArray(availableActions) && availableActions.length > 0;
  const hasRenderableCubeDiceRollAction =
    phaseKey === 'build.dice_roll' &&
    getRenderableServerChoiceActions(phaseKey, availableActions).some(
      (action) => action.actionId === 'CUB#0' && action.shipDefId === 'CUB'
    );
  const knoRerollPassIndex = getKnoRerollPassIndex(rawState);
  const buildServerKey = `BUILD_${turnNumber}`;
  const drawingParticipation: DrawingViewerParticipation = isViewerPlayer
    ? 'participant'
    : isViewerSpectator
      ? 'non_participant'
      : 'unresolved';
  const normalizedDrawingPrelude = normalizeDrawingPrelude({
    phaseKey,
    turnNumber,
    participation: drawingParticipation,
    requesterDrawingPrelude: rawState?.requester?.drawingPrelude,
  });
  const authoritativeDrawingCommitment = getCommitmentForPlayer(
    rawState,
    buildServerKey,
    meReadyKey ?? me?.id,
  );
  const hasAuthoritativeDrawingCommitment =
    isCommitmentCommitted(authoritativeDrawingCommitment);
  const drawingSubmissionInputLocked =
    hasAuthoritativeDrawingCommitment || buildSubmittedByTurn[turnNumber] === true;
  const drawingStage = deriveDrawingStage({
    normalizedPrelude: normalizedDrawingPrelude,
    hasExistingDrawingCommitment: hasAuthoritativeDrawingCommitment,
  });
  const drawingBuildSubmitEligible = canSubmitDrawingBuild({
    participation: drawingParticipation,
    phaseKey,
    turnNumber,
    normalizedPrelude: normalizedDrawingPrelude,
  });
  const canEditCurrentDrawingBuild =
    drawingBuildSubmitEligible &&
    drawingStage.kind === 'normal' &&
    !drawingSubmissionInputLocked;
  const committedDrawingProjectionKey = [
    effectiveGameId ?? 'nogame',
    meReadyKey ?? me?.id ?? 'unresolved',
    turnNumber,
  ].join('::');
  const carrierPreludeActionValidation =
    drawingStage.kind === 'prelude'
      ? validateProjectedCarrierActions(availableActions, drawingStage.passIndex)
      : { ok: false as const, reason: 'Drawing prelude is not awaiting actions' };
  const drawingViewerIdentity =
    drawingParticipation === 'participant'
      ? `player:${meReadyKey ?? me?.id ?? 'unresolved'}`
      : `viewer:${viewerMode}`;
  const drawingPhaseInstanceKey = [
    effectiveGameId ?? 'nogame',
    drawingViewerIdentity,
    turnNumber,
    'build.drawing',
    getDrawingPhaseInstanceSuffix(drawingStage),
  ].join('::');
  const phaseInstanceKey =
    phaseKey === 'build.drawing'
      ? drawingPhaseInstanceKey
      : phaseKey === 'build.dice_roll' && hasRenderableCubeDiceRollAction
      ? `${turnNumber}::${phaseKey}::cube`
      : phaseKey === 'build.dice_roll' &&
          (knoRerollPassIndex === 1 || knoRerollPassIndex === 2 || knoRerollPassIndex === 3)
        ? `${turnNumber}::${phaseKey}::kno${knoRerollPassIndex}`
        : `${turnNumber}::${phaseKey}`;
  const deferredHandoffPhaseEntryKey = `${effectiveGameId ?? 'nogame'}::${phaseInstanceKey}`;
  
  // ============================================================================
  // SHIP CHOICE SELECTION STATE (for charge panels)
  // ============================================================================
  
  const [shipChoiceSelectionByInstanceId, setShipChoiceSelectionByInstanceId] = useState<Record<string, string>>({});
  const explicitShipChoiceBySourceRef = useRef<Record<string, string>>({});
  const drawingPreludeSubmissionGuardRef = useRef<string | null>(null);
  const [ancientChargeDeclarationWorkflow, setAncientChargeDeclarationWorkflow] =
    useState<AncientChargeDeclarationWorkflow | null>(null);
  const [ancientChargeDeclarationAttempt, setAncientChargeDeclarationAttempt] =
    useState<FrozenAncientChargeDeclarationAttempt | null>(null);
  const [ancientAutocastEnabled, setAncientAutocastEnabled] =
    useState(false);
  const [ancientBlackHoleHover, setAncientBlackHoleHover] =
    useState<{ workflowKey: string; stackKey: string } | null>(null);
  const [ancientSimulacrumHover, setAncientSimulacrumHover] =
    useState<{ workflowKey: string; stackKey: string } | null>(null);
  const ancientRejectionRecoveryBaselineStateRef = useRef<any>(null);
  const ancientAutoEntryGuardWorkflowKeyRef = useRef<string | null>(null);
  
  // ============================================================================
  // TASK A: HARD RESET PREVIEW STATE ON TURN CHANGE
  // ============================================================================
  
  // When server turnNumber changes, clear all local build preview state
  // This prevents cross-turn contamination (e.g., turn 1 preview overlaying turn 2 fleet)
  useEffect(() => {
    if (!rawState) return;
    
    const serverTurnNumber = getTurnNumber(rawState);
    
    // Turn boundary: any local build preview is now invalid
    setBuildPreviewCounts({});
    buildPreviewCountsRef.current = {};
    setBuildPreviewTurnNumber(null);
    buildPreviewTurnNumberRef.current = null;
    setFrigateSelectedTriggers([]);
    frigateSelectedTriggersRef.current = [];
    frigatePreviewTriggerByRowIdRef.current = {};
    setQuantumMysticSelectedNumbers([]);
    quantumMysticSelectedNumbersRef.current = [];
    quantumMysticPreviewNumberByRowIdRef.current = {};
    setEvolverChoicesByRowId({});
    evolverChoicesByRowIdRef.current = {};
    committedDrawingProjectionRef.current = null;
    setAwaitingBuildRevealSync(false);
    
    console.log('[useGameSession] Turn boundary reset: cleared preview state for turn', serverTurnNumber);
  }, [rawState?.gameData?.turnNumber ?? rawState?.turnNumber]);
  
  // ============================================================================
  // CHUNK 9.1: BOOTSTRAP READINESS CHECK (BOOT GATING)
  // ============================================================================
  
  // Determine if we have a valid server state with valid phaseKey
  // - true = still bootstrapping (no valid state yet)
  // - false = ready to render game UI
  // Defensive: check typeof to prevent crashes if import resolution fails
  const hasValidPhaseKey = 
    typeof phaseKey === 'string' && 
    phaseKey.length > 0 && 
    phaseKey !== 'unknown' &&
    typeof isValidPhaseKey === 'function' &&
    isValidPhaseKey(phaseKey);
  
  const isBootstrapping = !rawState || !hasValidPhaseKey;
  
  // Phase instance key for completion tracking
  // MUST be defined early — used by preview merge, build gating, and ready logic
  // Ready UX state for current phase (for SENDING/WAITING labels)
  const readyUxForCurrentPhase =
    readyUxByPhaseInstanceKey[phaseInstanceKey] ?? { clickedThisPhase: false, sendingNow: false };

  // Client-only key (UI gating / local phase completion concept)
  const buildPhaseInstanceKey = `${turnNumber}::build`;
  
  // Determine major phase for icon
  const majorPhase = phaseKey.split('.')[0] || 'build';
  const phaseIcon: 'build' | 'battle' = majorPhase === 'battle' ? 'battle' : 'build';
  const hasMatchingAuthoritativeGameId =
    typeof rawState?.gameId !== 'string' || rawState.gameId === effectiveGameId;
  const authoritativeDiceValue = (() => {
    if (!hasMatchingAuthoritativeGameId) {
      return 1 as const;
    }

    const raw =
      rawState?.gameData?.turnData?.effectiveDiceRoll ??
      rawState?.gameData?.turnData?.baseDiceRoll ??
      rawState?.gameData?.turnData?.diceRoll ??
      rawState?.gameData?.diceRoll ??
      1;

    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1 || num > 6) {
      return 1 as const;
    }

    return num as 1 | 2 | 3 | 4 | 5 | 6;
  })();
  const authoritativeMainLeftRailDiceSignature = (() => {
    if (
      !effectiveGameId ||
      !hasMatchingAuthoritativeGameId ||
      isBootstrapping ||
      !hasValidPhaseKey
    ) {
      return null;
    }

    return JSON.stringify({
      gameId: effectiveGameId,
      turnNumber,
      diceValue: authoritativeDiceValue,
    });
  })();
  const chronoswarmRolls = getChronoswarmRolls(rawState);
  const cubeDiceValueByPlayerId = getCubeDiceValueByPlayerId(rawState);
  const cubeDiceUsedByPlayerId = getCubeDiceUsedByPlayerId(rawState);
  const hasAuthoritativeChronoswarmDice = Array.isArray(chronoswarmRolls)
    ? chronoswarmRolls.some(
        (roll: unknown) =>
          typeof roll === 'number' && Number.isInteger(roll) && roll >= 1 && roll <= 6
      )
    : false;

  function normalizeFinishReasonToken(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  function getFinishReasonCandidates(payload: any): string[] {
    const candidates: string[] = [];

    function add(value: unknown): void {
      const normalized = normalizeFinishReasonToken(value);
      if (normalized) {
        candidates.push(normalized);
      }
    }

    const state = payload?.state ?? payload;
    const gameData = state?.gameData;

    add(payload?.resultReason);
    add(payload?.reason);
    add(payload?.endReason);
    add(payload?.finishReason);
    add(payload?.statusReason);
    add(state?.resultReason);
    add(state?.reason);
    add(state?.endReason);
    add(state?.finishReason);
    add(state?.statusReason);
    add(gameData?.resultReason);
    add(gameData?.reason);
    add(gameData?.endReason);
    add(gameData?.finishReason);
    add(gameData?.statusReason);

    if (Array.isArray(payload?.events)) {
      for (const event of payload.events) {
        add(event?.resultReason);
        add(event?.reason);
        add(event?.endReason);
        add(event?.finishReason);
        add(event?.statusReason);
        add(event?.type);
        add(event?.intentType);
        add(event?.action);
      }
    }

    return candidates;
  }

  function isNonHealthResolutionFinishReason(reason: unknown): boolean {
    const normalized = normalizeFinishReasonToken(reason);
    if (!normalized) {
      return false;
    }

    const compact = normalized.replace(/[\s-]+/g, '_');
    const withoutSeparators = compact.replace(/_/g, '');

    return (
      compact.includes('resign') ||
      compact.includes('surrender') ||
      compact.includes('agreement') ||
      compact.includes('agreed_draw') ||
      compact.includes('manual_draw') ||
      compact.includes('draw_offer') ||
      compact.includes('draw_accept') ||
      compact.includes('mutual_draw') ||
      compact.includes('abort') ||
      compact.includes('abandon') ||
      compact.includes('cancelled') ||
      compact.includes('canceled') ||
      compact.includes('empty_private_game') ||
      compact.includes('timeout') ||
      compact.includes('clock') ||
      compact === 'time' ||
      compact.includes('time_expired') ||
      withoutSeparators === 'emptyprivategame'
    );
  }

  function hasNonHealthResolutionFinishReason(payload: any): boolean {
    return getFinishReasonCandidates(payload).some(isNonHealthResolutionFinishReason);
  }

  function hasCompletedTurnHealthStats(
    state: any,
    localPlayerId: string | null,
    opponentPlayerId: string | null
  ): boolean {
    const lastTurnNetByPlayerId = state?.gameData?.lastTurnNetByPlayerId;
    const lastTurnHealByPlayerId = state?.gameData?.lastTurnHealByPlayerId;
    const lastTurnDamageByPlayerId = state?.gameData?.lastTurnDamageByPlayerId;

    return (
      readOwnFiniteNumber(lastTurnNetByPlayerId, localPlayerId).present &&
      readOwnFiniteNumber(lastTurnHealByPlayerId, localPlayerId).present &&
      readOwnFiniteNumber(lastTurnDamageByPlayerId, localPlayerId).present &&
      readOwnFiniteNumber(lastTurnNetByPlayerId, opponentPlayerId).present &&
      readOwnFiniteNumber(lastTurnHealByPlayerId, opponentPlayerId).present &&
      readOwnFiniteNumber(lastTurnDamageByPlayerId, opponentPlayerId).present
    );
  }

  function hasIntentEndOfTurnHealthResolutionEvent(result: any): boolean {
    if (result?.ok !== true || !Array.isArray(result?.events)) {
      return false;
    }

    return result.events.some((event: any) =>
      event?.type === 'BATTLE_LOG_FINALIZE_TURN' ||
      (event?.type === 'EFFECT_APPLIED' && event?.kind === 'AggregatedHealthChange')
    );
  }

  function getIntentResolvedTurnKey(
    result: any,
    meta?: { label?: string; turn?: number; phaseKey?: string }
  ): string | null {
    if (result?.ok !== true || !result?.state || !Array.isArray(result?.events)) {
      return null;
    }

    let hasAggregatedHealthChange = false;
    for (const event of result.events) {
      if (event?.type === 'BATTLE_LOG_FINALIZE_TURN') {
        const finalizedTurnNumber = event?.finalizedTurnNumber;
        return Number.isInteger(finalizedTurnNumber)
          ? String(finalizedTurnNumber)
          : String(meta?.turn ?? turnNumber);
      }

      if (event?.type === 'EFFECT_APPLIED' && event?.kind === 'AggregatedHealthChange') {
        hasAggregatedHealthChange = true;
      }
    }

    return hasAggregatedHealthChange ? String(meta?.turn ?? turnNumber) : null;
  }

  function buildHealthPresentationFromState(args: {
    state: any;
    resolvedTurnKey: string;
  }): HealthPresentationBuildResult | null {
    const { state, resolvedTurnKey } = args;

    if (!effectiveGameId || !state || typeof state !== 'object') {
      return null;
    }

    if (typeof state.gameId === 'string' && state.gameId !== effectiveGameId) {
      return null;
    }

    const localPlayerId = getPlayerIdentityKey(displayLeftPlayer);
    const opponentPlayerId = getPlayerIdentityKey(displayRightPlayer);
    if (!localPlayerId || !opponentPlayerId) {
      return null;
    }

    if (!hasCompletedTurnHealthStats(state, localPlayerId, opponentPlayerId)) {
      return null;
    }

    const localPlayer = findPlayerByIdentity(state, localPlayerId);
    const opponentPlayer = findPlayerByIdentity(state, opponentPlayerId);
    const myHealth = localPlayer?.health;
    const opponentHealth = opponentPlayer?.health;
    const myMaxHealthRead = readExplicitProjectedMaxHealth(localPlayer?.maxHealth);
    const opponentMaxHealthRead = readExplicitProjectedMaxHealth(opponentPlayer?.maxHealth);
    if (
      typeof myHealth !== 'number' ||
      !Number.isFinite(myHealth) ||
      typeof opponentHealth !== 'number' ||
      !Number.isFinite(opponentHealth) ||
      !myMaxHealthRead.present ||
      !opponentMaxHealthRead.present
    ) {
      return null;
    }
    const myMaxHealth = myMaxHealthRead.value;
    const opponentMaxHealth = opponentMaxHealthRead.value;

    const lastTurnNetByPlayerId = state?.gameData?.lastTurnNetByPlayerId;
    const lastTurnHealByPlayerId = state?.gameData?.lastTurnHealByPlayerId;
    const lastTurnDamageByPlayerId = state?.gameData?.lastTurnDamageByPlayerId;
    const myNet = readOwnFiniteNumber(lastTurnNetByPlayerId, localPlayerId);
    const myHeal = readOwnFiniteNumber(lastTurnHealByPlayerId, localPlayerId);
    const myDamageTaken = readOwnFiniteNumber(lastTurnDamageByPlayerId, localPlayerId);
    const opponentNet = readOwnFiniteNumber(lastTurnNetByPlayerId, opponentPlayerId);
    const opponentHeal = readOwnFiniteNumber(lastTurnHealByPlayerId, opponentPlayerId);
    const opponentDamageTaken = readOwnFiniteNumber(lastTurnDamageByPlayerId, opponentPlayerId);

    if (
      !myNet.present ||
      !myHeal.present ||
      !myDamageTaken.present ||
      !opponentNet.present ||
      !opponentHeal.present ||
      !opponentDamageTaken.present
    ) {
      return null;
    }

    const responseTurnNumber = getTurnNumber(state);
    const responseIsFinished =
      state?.status === 'finished' ||
      state?.gameData?.status === 'finished';
    const resolvedTurnNumber = Number(resolvedTurnKey);
    if (!Number.isInteger(resolvedTurnNumber) || resolvedTurnNumber < 1) {
      return null;
    }
    const displayTurnNumber = responseIsFinished
      ? resolvedTurnNumber
      : responseTurnNumber;
    const isTerminalTurn = responseIsFinished;

    const signature = JSON.stringify({
      gameId: effectiveGameId,
      viewerRole: isViewerSpectator ? 'spectator' : 'player',
      resolvedTurnKey,
      displayTurnNumber,
      isTerminalTurn,
      localPlayerId,
      opponentPlayerId,
      myHealth,
      opponentHealth,
      myMaxHealth,
      opponentMaxHealth,
      myNet: myNet.value,
      myHeal: myHeal.value,
      myDamageTaken: myDamageTaken.value,
      opponentNet: opponentNet.value,
      opponentHeal: opponentHeal.value,
      opponentDamageTaken: opponentDamageTaken.value,
    });

    return {
      trigger: {
        signature,
        resolvedTurnKey,
        displayTurnNumber,
        isTerminalTurn,
        healthPresentation: {
          boardMode: 'board',
          viewerRole: isViewerSpectator ? 'spectator' : 'player',
          meName: localPlayer?.name ?? displayLeftPlayer?.name ?? 'Player 1',
          opponentName: opponentPlayer?.name ?? displayRightPlayer?.name ?? 'Player 2',
          myHealth,
          opponentHealth,
          myMaxHealth,
          opponentMaxHealth,
          hasExplicitProjectedMaxHealth: true,
          myLastTurnNet: myNet.value,
          opponentLastTurnNet: opponentNet.value,
          spectatorHasTwoPlayers: isViewerSpectator && displayLeftPlayer != null && displayRightPlayer != null,
          spectatorLeftName: localPlayer?.name ?? displayLeftPlayer?.name ?? 'Player 1',
          spectatorRightName: opponentPlayer?.name ?? displayRightPlayer?.name ?? 'Player 2',
          spectatorLeftNet: isViewerSpectator ? myNet.value : 0,
          spectatorRightNet: isViewerSpectator ? opponentNet.value : 0,
        },
      },
      boardOverride: {
        signature,
        resolvedTurnKey,
        responseTurnNumber,
        responseIsFinished,
        myHealth,
        opponentHealth,
        myMaxHealth,
        opponentMaxHealth,
        myLastTurnHeal: myHeal.value,
        // Server damage map is damage taken; the board's damage stat displays damage dealt.
        myLastTurnDamage: opponentDamageTaken.value,
        myLastTurnNet: myNet.value,
        opponentLastTurnHeal: opponentHeal.value,
        opponentLastTurnDamage: myDamageTaken.value,
        opponentLastTurnNet: opponentNet.value,
      },
    };
  }

  function publishHealthResolutionPresentation(
    presentation: HealthPresentationBuildResult | null,
    options: { useBoardOverride: boolean }
  ): void {
    if (!presentation || !effectiveGameId) {
      return;
    }

    const presentationIdentity = `${effectiveGameId}::${presentation.trigger.resolvedTurnKey}`;
    if (publishedHealthPresentationIdentitiesRef.current.has(presentationIdentity)) {
      return;
    }

    publishedHealthPresentationIdentitiesRef.current.add(presentationIdentity);
    setHealthResolutionPresentationTrigger(presentation.trigger);

    if (options.useBoardOverride) {
      setHealthPresentationBoardOverride(presentation.boardOverride);
    }
  }

  function handleIntentResultForHealthPresentation(
    result: any,
    meta?: { label?: string; turn?: number; phaseKey?: string }
  ): void {
    const localPlayerId = getPlayerIdentityKey(displayLeftPlayer);
    const opponentPlayerId = getPlayerIdentityKey(displayRightPlayer);
    if (
      !hasIntentEndOfTurnHealthResolutionEvent(result) ||
      hasNonHealthResolutionFinishReason(result) ||
      !hasCompletedTurnHealthStats(result?.state, localPlayerId, opponentPlayerId)
    ) {
      return;
    }

    const resolvedTurnKey = getIntentResolvedTurnKey(result, meta);
    if (!resolvedTurnKey) {
      return;
    }

    publishHealthResolutionPresentation(
      buildHealthPresentationFromState({
        state: result.state,
        resolvedTurnKey,
      }),
      { useBoardOverride: true }
    );
  }

  useEffect(() => {
    const override = healthPresentationBoardOverride;
    if (!override || !rawState) {
      return;
    }

    if (typeof rawState?.gameId === 'string' && rawState.gameId !== effectiveGameId) {
      return;
    }

    const authoritativeIsFinished =
      rawState?.status === 'finished' ||
      rawState?.gameData?.status === 'finished';
    const authoritativeTurnNumber = getTurnNumber(rawState);

    if (
      (override.responseIsFinished && authoritativeIsFinished) ||
      (!override.responseIsFinished && authoritativeTurnNumber >= override.responseTurnNumber)
    ) {
      setHealthPresentationBoardOverride(null);
    }
  }, [effectiveGameId, healthPresentationBoardOverride, rawState]);

  useLayoutEffect(() => {
    if (
      !effectiveGameId ||
      !rawState ||
      !hasMatchingAuthoritativeGameId ||
      isBootstrapping
    ) {
      return;
    }

    const currentTurnNumber = getTurnNumber(rawState);
    const currentIsFinished =
      rawState?.status === 'finished' ||
      rawState?.gameData?.status === 'finished';
    const previousObserved = previousObservedHealthResolutionRef.current;
    const currentObserved = {
      gameId: effectiveGameId,
      turnNumber: currentTurnNumber,
      isFinished: currentIsFinished,
    };

    if (!previousObserved || previousObserved.gameId !== effectiveGameId) {
      previousObservedHealthResolutionRef.current = currentObserved;
      return;
    }

    let resolvedTurnKey: string | null = null;
    if (currentTurnNumber > previousObserved.turnNumber) {
      resolvedTurnKey = String(previousObserved.turnNumber);
    } else if (!previousObserved.isFinished && currentIsFinished) {
      resolvedTurnKey = String(currentTurnNumber);
    }

    previousObservedHealthResolutionRef.current = currentObserved;

    if (!resolvedTurnKey) {
      return;
    }

    const localPlayerId = getPlayerIdentityKey(displayLeftPlayer);
    const opponentPlayerId = getPlayerIdentityKey(displayRightPlayer);
    if (
      hasNonHealthResolutionFinishReason(rawState) ||
      !hasCompletedTurnHealthStats(rawState, localPlayerId, opponentPlayerId)
    ) {
      return;
    }

    publishHealthResolutionPresentation(
      buildHealthPresentationFromState({
        state: rawState,
        resolvedTurnKey,
      }),
      { useBoardOverride: false }
    );
  }, [
    effectiveGameId,
    hasMatchingAuthoritativeGameId,
    isBootstrapping,
    rawState,
    displayLeftPlayer?.id,
    displayLeftPlayer?.playerId,
    displayLeftPlayer?.sessionId,
    displayRightPlayer?.id,
    displayRightPlayer?.playerId,
    displayRightPlayer?.sessionId,
  ]);
  
  // Determine if we're in species selection phase
  const isInSpeciesSelection = phaseKey === 'setup.species_selection';
  const isComputerGame = useMemo(() => {
    const controllersByPlayerId =
      rawState?.controllersByPlayerId ??
      rawState?.gameData?.controllersByPlayerId ??
      null;

    return Boolean(
      controllersByPlayerId &&
      Object.values(controllersByPlayerId).some((controller: any) => controller?.kind === 'bot')
    );
  }, [rawState]);
  const speciesSelectionEntryKey = `${effectiveGameId ?? 'nogame'}::${phaseInstanceKey}`;

  useEffect(() => {
    if (!isInSpeciesSelection) {
      lastSpeciesSelectionEntryKeyRef.current = null;
      speciesConfirmationGuardRef.current = null;
      setPendingSpeciesConfirmation(null);
      return;
    }

    if (lastSpeciesSelectionEntryKeyRef.current === speciesSelectionEntryKey) return;

    lastSpeciesSelectionEntryKeyRef.current = speciesSelectionEntryKey;
    speciesConfirmationGuardRef.current = null;
    setPendingSpeciesConfirmation(null);
    setSelectedSpecies('human');
    setSelectedBotSpecies('human');
  }, [isInSpeciesSelection, speciesSelectionEntryKey]);
  
  // Helper: normalize species from server data
  function normalizeSpecies(serverValue: string | null | undefined): SpeciesId | null {
    if (!serverValue) return null;
    const normalized = serverValue.toLowerCase();
    
    switch (normalized) {
      case 'human':
        return 'human';
      case 'xenite':
        return 'xenite';
      case 'centaur':
        return 'centaur';
      case 'ancient':
        return 'ancient';
      default:
        return null;
    }
  }
  
  // Species detection (from ME and OPPONENT)
  const mySpecies = normalizeSpecies(me?.faction ?? me?.species);
  const opponentSpecies = normalizeSpecies(opponent?.faction ?? opponent?.species);
  const p1Species = normalizeSpecies(p1?.faction ?? p1?.species);
  const p2Species = normalizeSpecies(p2?.faction ?? p2?.species);
  const displayLeftSpecies = normalizeSpecies(displayLeftPlayer?.faction ?? displayLeftPlayer?.species);
  const displayRightSpecies = normalizeSpecies(displayRightPlayer?.faction ?? displayRightPlayer?.species);

  const authoritativeAncientEnergy = getPublicAncientEnergyForPlayer(rawState, me?.id);
  const authoritativeAncientEnergyCapacity =
    getPublicAncientEnergyCapacityForPlayer(rawState, me?.id);
  const ancientDeclarationActions = getAncientChargeDeclarationActions(availableActions);
  const ancientChargeDeclarationWorkflowKey =
    `${effectiveGameId ?? 'nogame'}::${me?.id ?? 'noplayer'}::${phaseInstanceKey}`;
  const ancientPlayerReady = isPlayerReadyForPhase(rawState, me?.id);
  const ancientDeclarationActionsLoaded = Array.isArray(availableActions);
  const hasPendingAncientRejectionRecovery =
    ancientChargeDeclarationWorkflow?.key === ancientChargeDeclarationWorkflowKey &&
    ancientChargeDeclarationWorkflow.rejectionRecoveryPending;
  const shouldPresentAncientChargeDeclaration =
    phaseKey === 'battle.charge_declaration' &&
    myRole === 'player' &&
    mySpecies === 'ancient' &&
    !ancientPlayerReady &&
    (
      hasPendingAncientRejectionRecovery ||
      (
        ancientDeclarationActionsLoaded &&
        (ancientDeclarationActions.length > 0 || getAncientEnergyTotal(authoritativeAncientEnergy) > 0)
      )
    );
  const initialAncientChargeDeclarationWorkflow: AncientChargeDeclarationWorkflow | null =
    shouldPresentAncientChargeDeclaration && !hasPendingAncientRejectionRecovery
      ? {
          key: ancientChargeDeclarationWorkflowKey,
          stage: deriveAncientChargeDeclarationInitialStage(ancientDeclarationActions),
          hadChargeStage: ancientDeclarationActions.length > 0,
          entryDisposition: 'unresolved',
          localManualSolarCasts: [],
          selectorMode: null,
          blackHoleSelectedTargetInstanceIds: [],
          rejectionRecoveryPending: false,
        }
      : null;
  const activeAncientChargeDeclarationWorkflow =
    shouldPresentAncientChargeDeclaration &&
    ancientChargeDeclarationWorkflow?.key === ancientChargeDeclarationWorkflowKey
      ? ancientChargeDeclarationWorkflow
      : initialAncientChargeDeclarationWorkflow;
  const activeAncientChargeDeclarationAttempt =
    ancientChargeDeclarationAttempt?.workflowKey === ancientChargeDeclarationWorkflowKey
      ? ancientChargeDeclarationAttempt
      : null;
  const ancientSolarPresentationCasts = selectAncientSolarPresentationCasts({
    currentWorkflowKey: ancientChargeDeclarationWorkflowKey,
    workflow: activeAncientChargeDeclarationWorkflow,
    frozenAttempt: activeAncientChargeDeclarationAttempt,
  });
  const publicAncientSolarLedgers =
    rawState?.publicState?.ancient?.solarLedgerByPlayerId as Record<string, unknown> | undefined;
  const materializedSimulacrumLedgerEntryIdsByPlayerId =
    getMaterializedSimulacrumLedgerEntryIdsByPlayerId(rawState);
  const getSuppressedSimulacrumLedgerEntryIds = (
    playerId: string | null | undefined
  ): ReadonlySet<string> | undefined =>
    majorPhase === 'build' && playerId
      ? new Set(materializedSimulacrumLedgerEntryIdsByPlayerId[playerId] ?? [])
      : undefined;
  const displayLeftAncientSolarEntries = deriveAncientSolarDisplayEntries({
    playerId: displayLeftPlayer?.id,
    ledger: displayLeftPlayer?.id ? publicAncientSolarLedgers?.[displayLeftPlayer.id] : null,
    allowLocalPreview:
      !isViewerSpectator &&
      myRole === 'player' &&
      mySpecies === 'ancient' &&
      phaseKey === 'battle.charge_declaration' &&
      displayLeftPlayer?.id === me?.id,
    currentBattleTurnNumber: turnNumber,
    localPreviewCasts: ancientSolarPresentationCasts,
    isAuthoritativelyReady: ancientPlayerReady,
    suppressedAuthoritativeLedgerEntryIds:
      getSuppressedSimulacrumLedgerEntryIds(displayLeftPlayer?.id),
  });
  const displayRightAncientSolarEntries = normalizeSpecies(
    displayRightPlayer?.faction ?? displayRightPlayer?.species
  ) === 'ancient'
    ? deriveAncientSolarDisplayEntries({
        playerId: displayRightPlayer?.id,
        ledger: displayRightPlayer?.id ? publicAncientSolarLedgers?.[displayRightPlayer.id] : null,
        allowLocalPreview: false,
        currentBattleTurnNumber: turnNumber,
        localPreviewCasts: [],
        isAuthoritativelyReady: isPlayerReadyForPhase(rawState, displayRightPlayer?.id),
        suppressedAuthoritativeLedgerEntryIds:
          getSuppressedSimulacrumLedgerEntryIds(displayRightPlayer?.id),
      })
    : [];
  const ancientSolarEntriesForMarkers = [
    ...displayLeftAncientSolarEntries,
    ...displayRightAncientSolarEntries,
  ];
  const showAncientSolarTargetMarkers =
    majorPhase === 'battle' && !isFinished;
  const ancientManualSolarCastReplay = replayAncientManualSolarCasts({
    startingPool: authoritativeAncientEnergy,
    localManualSolarCasts: activeAncientChargeDeclarationWorkflow?.localManualSolarCasts ?? [],
  });
  const provisionalAncientEnergy = ancientManualSolarCastReplay.remainingEnergy;
  const canCastAncientManualSolarPowerById = deriveAncientManualSolarCastability({
    stage: activeAncientChargeDeclarationWorkflow?.stage ?? 'charges',
    remainingEnergy: provisionalAncientEnergy,
    energySequenceValid: ancientManualSolarCastReplay.valid,
    attemptUnresolved: activeAncientChargeDeclarationAttempt != null,
    rejectionRecoveryPending:
      activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending === true,
  });
  const ancientSiphonSelector = deriveAncientSiphonSelectorState({
    stage: activeAncientChargeDeclarationWorkflow?.stage ?? 'charges',
    remainingEnergy: provisionalAncientEnergy,
    energySequenceValid: ancientManualSolarCastReplay.valid,
    attemptUnresolved: activeAncientChargeDeclarationAttempt != null,
    rejectionRecoveryPending:
      activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending === true,
  });
  const canCastAncientBlackHole = deriveAncientBlackHoleCastability({
    stage: activeAncientChargeDeclarationWorkflow?.stage ?? 'charges',
    remainingEnergy: provisionalAncientEnergy,
    energySequenceValid: ancientManualSolarCastReplay.valid,
    attemptUnresolved: activeAncientChargeDeclarationAttempt != null,
    rejectionRecoveryPending:
      activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending === true,
  });

  useLayoutEffect(() => {
    if (!initialAncientChargeDeclarationWorkflow && !hasPendingAncientRejectionRecovery) {
      if (ancientChargeDeclarationWorkflow != null) setAncientChargeDeclarationWorkflow(null);
      if (ancientChargeDeclarationAttempt != null) setAncientChargeDeclarationAttempt(null);
      if (
        activePanelId === 'ap.battle.charges.ancient' ||
        activePanelId === 'ap.battle.solar_powers.ancient'
      ) {
        setActivePanelId('ap.catalog.ships.ancient');
      }
      return;
    }

    if (
      initialAncientChargeDeclarationWorkflow &&
      ancientChargeDeclarationWorkflow?.key !== ancientChargeDeclarationWorkflowKey
    ) {
      setAncientChargeDeclarationWorkflow(initialAncientChargeDeclarationWorkflow);
    }
    if (
      ancientChargeDeclarationAttempt != null &&
      ancientChargeDeclarationAttempt.workflowKey !== ancientChargeDeclarationWorkflowKey
    ) {
      setAncientChargeDeclarationAttempt(null);
    }
  }, [
    activePanelId,
    ancientChargeDeclarationAttempt,
    ancientChargeDeclarationWorkflow,
    ancientChargeDeclarationWorkflowKey,
    initialAncientChargeDeclarationWorkflow,
    hasPendingAncientRejectionRecovery,
  ]);

  useLayoutEffect(() => {
    const workflow = ancientChargeDeclarationWorkflow;
    if (
      !workflow?.rejectionRecoveryPending ||
      workflow.key !== ancientChargeDeclarationWorkflowKey ||
      rawState == null ||
      rawState === ancientRejectionRecoveryBaselineStateRef.current
    ) {
      return;
    }

    ancientRejectionRecoveryBaselineStateRef.current = rawState;

    const refreshedAvailableActions = getAvailableActions(rawState);
    const refreshedEnergy = getUsableAncientEnergyPoolForPlayer(rawState, me?.id);
    const refreshedGameId = typeof rawState?.gameId === 'string' ? rawState.gameId : null;
    const refreshedPhaseKey = getPhaseKey(rawState);
    const refreshedTurnNumber = getTurnNumber(rawState);
    const recoverySnapshotUsable =
      refreshedGameId === effectiveGameId &&
      me?.id != null &&
      refreshedPhaseKey === 'battle.charge_declaration' &&
      refreshedTurnNumber === turnNumber &&
      !isPlayerReadyForPhase(rawState, me.id) &&
      Array.isArray(refreshedAvailableActions) &&
      refreshedEnergy != null;

    if (!recoverySnapshotUsable) {
      return;
    }

    const refreshedDeclarationActions = getAncientChargeDeclarationActions(refreshedAvailableActions);
    const nextStage = refreshedDeclarationActions.length > 0 ? 'charges' : 'powers';
    setShipChoiceSelectionByInstanceId((previousSelections) => {
      const nextSelections: Record<string, string> = {};

      for (const action of refreshedDeclarationActions) {
        const allowedChoiceIds = getRenderableActionChoiceIds(action);
        if (allowedChoiceIds.length === 0) continue;

        const previousChoiceId = previousSelections[action.sourceInstanceId];
        if (previousChoiceId && allowedChoiceIds.includes(previousChoiceId)) {
          nextSelections[action.sourceInstanceId] = previousChoiceId;
          continue;
        }

        const defaultChoiceId = getDefaultChoiceIdForRenderableAction(action);
        if (defaultChoiceId) {
          nextSelections[action.sourceInstanceId] = defaultChoiceId;
        }
      }

      const previousKeys = Object.keys(previousSelections);
      const nextKeys = Object.keys(nextSelections);
      const unchanged =
        previousKeys.length === nextKeys.length &&
        previousKeys.every((sourceInstanceId) =>
          previousSelections[sourceInstanceId] === nextSelections[sourceInstanceId]
        );
      return unchanged ? previousSelections : nextSelections;
    });
    setAncientChargeDeclarationWorkflow({
      key: ancientChargeDeclarationWorkflowKey,
      stage: nextStage,
      hadChargeStage: refreshedDeclarationActions.length > 0,
      entryDisposition: 'manual',
      localManualSolarCasts: [],
      selectorMode: null,
      blackHoleSelectedTargetInstanceIds: [],
      rejectionRecoveryPending: false,
    });
    if (activePanelId !== 'ap.menu.root') {
      setActivePanelId(
        nextStage === 'charges'
          ? 'ap.battle.charges.ancient'
          : 'ap.catalog.ships.ancient'
      );
    }
  }, [
    activePanelId,
    ancientChargeDeclarationWorkflow,
    ancientChargeDeclarationWorkflowKey,
    effectiveGameId,
    me?.id,
    rawState,
    turnNumber,
  ]);
  
  // Species labels for HUD (show "Selecting Species" if not revealed yet)
  function getSpeciesLabelForHud(player: any, species: SpeciesId | null): string {
    // If in species selection and species not yet revealed, show "Selecting Species"
    if (isInSpeciesSelection && !species) {
      return 'Selecting Species';
    }
    
    // Otherwise show the actual species (or default to Human if missing)
    const effectiveSpecies = species ?? 'human';
    return getSpeciesDisplayName(effectiveSpecies);
  }
  
  // Helper: Get species display name (Title Case)
  function getSpeciesDisplayName(species: SpeciesId): string {
    switch (species) {
      case 'human': return 'Human';
      case 'xenite': return 'Xenite';
      case 'centaur': return 'Centaur';
      case 'ancient': return 'Ancient';
    }
  }
  
  const displayLeftHasJoined = displayLeftPlayer?.role === 'player';
  const displayRightHasJoined = displayRightPlayer?.role === 'player';
  const displayLeftSpeciesLabel = displayLeftPlayer
    ? getSpeciesLabelForHud(displayLeftPlayer, displayLeftSpecies)
    : isViewerSpectator
      ? ''
      : 'Human';
  const displayRightSpeciesLabel =
    displayRightHasJoined && displayRightPlayer
      ? getSpeciesLabelForHud(displayRightPlayer, displayRightSpecies)
      : '';
  
  // ============================================================================
  // SHIP OWNERSHIP (ME/OPPONENT)
  // ============================================================================
  
  const {
    myShips,
    opponentShips,
    opponentShipsVisible,
    myFleet,
    opponentFleet,
    myVoidFleet,
    opponentVoidFleet,
  } = deriveFleets({
    rawState,
    me,
    opponent,
    turnNumber,
    majorPhase,
    opponentPublicCurrentChargesByInstanceId: opponent?.id
      ? publicMultiChargeByPlayerId[opponent.id]
      : undefined,
  });
  const firstStrikeClassification = classifyRenderableFirstStrikeActions(
    phaseKey === 'battle.first_strike' ? availableActions : null
  );
  const orderedFirstStrikeFamilies =
    phaseKey === 'battle.first_strike'
      ? orderFirstStrikeFamilies(firstStrikeClassification, myShips)
      : [];
  const orderedFirstStrikeFamiliesKey = orderedFirstStrikeFamilies.join('|');
  const isMixedFirstStrike =
    phaseKey === 'battle.first_strike' &&
    firstStrikeClassification.supportedFamilies.length >= 2;
  const hasCurrentMixedFirstStrikeState =
    isMixedFirstStrike &&
    mixedFirstStrikeHandoffState?.phaseInstanceKey === phaseInstanceKey;
  const storedFirstStrikeTargetingFamily = !isMixedFirstStrike
    ? null
    : hasCurrentMixedFirstStrikeState
      ? (
          mixedFirstStrikeHandoffState.activeFamily == null ||
          orderedFirstStrikeFamilies.includes(mixedFirstStrikeHandoffState.activeFamily)
        )
        ? mixedFirstStrikeHandoffState.activeFamily
        : orderedFirstStrikeFamilies[0] ?? null
      : orderedFirstStrikeFamilies[0] ?? null;
  const firstStrikeFamilyRankByFamily = isMixedFirstStrike
    ? orderedFirstStrikeFamilies.reduce<Partial<Record<FirstStrikeActionFamily, number>>>(
        (rankByFamily, family, index) => {
          rankByFamily[family] = index;
          return rankByFamily;
        },
        {}
      )
    : undefined;
  const frigateTriggerByInstanceId = getFrigateTriggerByInstanceId(rawState);
  const reservedAncientBlackHoleTargetInstanceIds =
    activeAncientChargeDeclarationWorkflow?.localManualSolarCasts.flatMap(
      (cast) =>
        cast.solarPowerId === 'SBLA' && Array.isArray(cast.targetInstanceIds)
          ? cast.targetInstanceIds
          : []
    ) ?? [];
  const ancientBlackHoleTargeting = deriveAncientBlackHoleTargetingState({
    opponentShipsVisible,
    opponentFleet,
    reservedTargetInstanceIds: reservedAncientBlackHoleTargetInstanceIds,
  });
  const ancientBlackHoleDamagePreview = deriveAncientBlackHoleDamagePreview(myShips);
  const ancientEffectiveDiceValue = getEffectiveDiceValueForPlayer(
    hasMatchingAuthoritativeGameId ? rawState : null,
    me?.id,
    authoritativeDiceValue,
  );
  const ancientSolarHoverValuesById = deriveAncientSolarHoverValues({
    effectiveDiceValue: ancientEffectiveDiceValue,
    chargeScopedFleet: getChargeScopedFleetForPlayer(rawState, me?.id),
    canCastManualSolarPowerById: canCastAncientManualSolarPowerById,
    siphonSelector: ancientSiphonSelector,
    canCastBlackHole: canCastAncientBlackHole,
    blackHoleDamagePreview: ancientBlackHoleDamagePreview,
  });
  const ancientBlackHoleSelectorActive =
    activeAncientChargeDeclarationWorkflow?.selectorMode === 'blackHole' &&
    activeAncientChargeDeclarationWorkflow.stage === 'powers' &&
    canCastAncientBlackHole &&
    ancientBlackHoleTargeting.requiredTargetCount > 0;
  const ancientBlackHoleSelectedTargetInstanceIds =
    activeAncientChargeDeclarationWorkflow?.blackHoleSelectedTargetInstanceIds ?? [];
  const ancientBlackHoleBoardTargeting = buildAncientBlackHoleBoardTargeting({
    active: ancientBlackHoleSelectorActive,
    targeting: ancientBlackHoleTargeting,
    selectedTargetInstanceIds: ancientBlackHoleSelectedTargetInstanceIds,
    hoveredStackKey:
      ancientBlackHoleHover?.workflowKey === ancientChargeDeclarationWorkflowKey
        ? ancientBlackHoleHover.stackKey
        : null,
  });
  const ancientSimulacrumTargeting = deriveAncientSimulacrumTargetingState({
    opponentShipsVisible,
    opponentFleet,
    myShips,
    localManualSolarCasts:
      activeAncientChargeDeclarationWorkflow?.localManualSolarCasts ?? [],
    remainingBlue: provisionalAncientEnergy.blue,
  });
  const ancientSimulacrumSelector = deriveAncientSimulacrumSelectorState({
    stage: activeAncientChargeDeclarationWorkflow?.stage ?? 'charges',
    remainingEnergy: provisionalAncientEnergy,
    energySequenceValid: ancientManualSolarCastReplay.valid,
    attemptUnresolved: activeAncientChargeDeclarationAttempt != null,
    rejectionRecoveryPending:
      activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending === true,
    hasEligibleTarget: ancientSimulacrumTargeting.hasEligibleTarget,
  });
  const ancientAutocastEntryDecision = deriveAncientAutocastEntryDecision({
    remainingEnergy: provisionalAncientEnergy,
    hasEligibleSimulacrumTarget: ancientSimulacrumTargeting.hasEligibleTarget,
    siphonMinimumSpend: ANCIENT_SIPHON_MINIMUM_SPEND,
  });
  const ancientChargesDirectSubmissionEligible =
    activeAncientChargeDeclarationWorkflow?.stage === 'charges' &&
    activeAncientChargeDeclarationWorkflow.entryDisposition === 'unresolved' &&
    ancientAutocastEnabled &&
    getAncientEnergyTotal(provisionalAncientEnergy) > 0 &&
    !ancientAutocastEntryDecision.requiresManualPause;
  const hasLocalSimulacrumCast =
    activeAncientChargeDeclarationWorkflow?.localManualSolarCasts.some(
      (cast) => cast.solarPowerId === 'SSIM'
    ) === true;
  const shouldAutoCloseAncientSimulacrumSelector =
    activeAncientChargeDeclarationWorkflow?.selectorMode === 'simulacrum' &&
    hasLocalSimulacrumCast &&
    (
      provisionalAncientEnergy.blue <= 1 ||
      !ancientSimulacrumTargeting.hasEligibleTarget
    );
  const ancientSimulacrumSelectorActive =
    activeAncientChargeDeclarationWorkflow?.selectorMode === 'simulacrum' &&
    ancientSimulacrumSelector.canRemainOpen;
  const ancientSimulacrumBoardTargeting = buildAncientSimulacrumBoardTargeting({
    active: ancientSimulacrumSelectorActive,
    targeting: ancientSimulacrumTargeting,
    hoveredStackKey:
      ancientSimulacrumHover?.workflowKey === ancientChargeDeclarationWorkflowKey
        ? ancientSimulacrumHover.stackKey
        : null,
  });
  const ancientSimulacrumHoveredStackIsTargetable =
    ancientSimulacrumHover?.workflowKey === ancientChargeDeclarationWorkflowKey &&
    ancientSimulacrumBoardTargeting.targetStatesBySide.opponent[
      ancientSimulacrumHover.stackKey
    ]?.isTargetable === true;
  const ancientSimulacrumHoveredTarget =
    ancientSimulacrumSelectorActive &&
    ancientSimulacrumHover?.workflowKey === ancientChargeDeclarationWorkflowKey &&
    ancientSimulacrumHoveredStackIsTargetable
      ? allocateNextAncientSimulacrumTarget({
          targeting: ancientSimulacrumTargeting,
          stackKey: ancientSimulacrumHover.stackKey,
        })
      : null;
  const ancientSimulacrumHoveredPreviewBlueCost =
    ancientSimulacrumHoveredTarget?.previewBlueCost ?? null;

  useLayoutEffect(() => {
    setAncientChargeDeclarationWorkflow((current) => {
      if (current?.key !== ancientChargeDeclarationWorkflowKey || current.selectorMode == null) {
        return current;
      }

      let selectorStillAvailable = false;
      switch (current.selectorMode) {
        case 'siphon':
          selectorStillAvailable = ancientSiphonSelector.canOpen;
          break;
        case 'blackHole':
          selectorStillAvailable =
            canCastAncientBlackHole &&
            ancientBlackHoleTargeting.requiredTargetCount > 0;
          break;
        case 'simulacrum':
          selectorStillAvailable =
            ancientSimulacrumSelector.canRemainOpen &&
            !shouldAutoCloseAncientSimulacrumSelector;
          break;
      }
      if (selectorStillAvailable) {
        return current;
      }

      return {
        ...current,
        selectorMode: null,
        blackHoleSelectedTargetInstanceIds: [],
      };
    });

    if (
      ancientBlackHoleHover != null &&
      (
        ancientBlackHoleHover.workflowKey !== ancientChargeDeclarationWorkflowKey ||
        activeAncientChargeDeclarationWorkflow?.selectorMode !== 'blackHole' ||
        !canCastAncientBlackHole ||
        ancientBlackHoleTargeting.requiredTargetCount === 0
      )
    ) {
      setAncientBlackHoleHover(null);
    }

    if (
      ancientSimulacrumHover != null &&
      (
        ancientSimulacrumHover.workflowKey !== ancientChargeDeclarationWorkflowKey ||
        activeAncientChargeDeclarationWorkflow?.selectorMode !== 'simulacrum' ||
        !ancientSimulacrumSelector.canRemainOpen ||
        shouldAutoCloseAncientSimulacrumSelector ||
        !ancientSimulacrumHoveredStackIsTargetable
      )
    ) {
      setAncientSimulacrumHover(null);
    }
  }, [
    activeAncientChargeDeclarationWorkflow?.selectorMode,
    ancientBlackHoleHover,
    ancientBlackHoleTargeting.requiredTargetCount,
    ancientChargeDeclarationWorkflowKey,
    ancientSimulacrumHover,
    ancientSimulacrumHoveredStackIsTargetable,
    ancientSimulacrumSelector.canRemainOpen,
    ancientSiphonSelector.canOpen,
    canCastAncientBlackHole,
    shouldAutoCloseAncientSimulacrumSelector,
  ]);

  const spectatorDisplayLeftFleets = isViewerSpectator
    ? deriveFleets({
        rawState,
        me: null,
        opponent: displayLeftPlayer,
        turnNumber,
        majorPhase,
        opponentPublicCurrentChargesByInstanceId: displayLeftPlayer?.id
          ? publicMultiChargeByPlayerId[displayLeftPlayer.id]
          : undefined,
      })
    : null;
  const spectatorDisplayRightFleets = isViewerSpectator
    ? deriveFleets({
        rawState,
        me: null,
        opponent: displayRightPlayer,
        turnNumber,
        majorPhase,
        opponentPublicCurrentChargesByInstanceId: displayRightPlayer?.id
          ? publicMultiChargeByPlayerId[displayRightPlayer.id]
          : undefined,
      })
    : null;
  const displayLeftFleet = spectatorDisplayLeftFleets?.opponentFleet ?? myFleet;
  const displayRightFleet = spectatorDisplayRightFleets?.opponentFleet ?? opponentFleet;
  const displayLeftVoidFleet = spectatorDisplayLeftFleets?.opponentVoidFleet ?? myVoidFleet;
  const displayRightVoidFleet = spectatorDisplayRightFleets?.opponentVoidFleet ?? opponentVoidFleet;

  useEffect(() => {
    if (
      !effectiveGameId ||
      !hasMatchingAuthoritativeGameId ||
      isBootstrapping ||
      majorPhase !== 'battle'
    ) {
      return;
    }

    const shipsData = getShipsByPlayerId(rawState);
    const nextPublicChargesByPlayerId: Record<string, Record<string, number>> = {};

    for (const player of allPlayers) {
      if (player?.role !== 'player' || typeof player.id !== 'string' || player.id.length === 0) {
        continue;
      }

      const authoritativeShips = Array.isArray(shipsData[player.id])
        ? shipsData[player.id]
        : [];
      const nextPublicChargesByInstanceId: Record<string, number> = {};

      for (const ship of authoritativeShips) {
        const createdTurn = ship?.createdTurn;
        const isPubliclyVisible =
          typeof createdTurn !== 'number' || createdTurn < turnNumber || majorPhase === 'battle';

        if (!isPubliclyVisible) {
          continue;
        }

        const rawShipDefId = String(ship?.shipDefId ?? '');
        if (!isShipDefId(rawShipDefId)) {
          continue;
        }

        const def = getShipDefinitionById(rawShipDefId);
        if ((def?.maxCharges ?? 0) <= 1) {
          continue;
        }

        const instanceId = ship?.instanceId ?? ship?.id;
        if (typeof instanceId !== 'string' || instanceId.length === 0) {
          continue;
        }

        nextPublicChargesByInstanceId[instanceId] = Number(ship?.chargesCurrent ?? 0);
      }

      nextPublicChargesByPlayerId[player.id] = nextPublicChargesByInstanceId;
    }

    setPublicMultiChargeByPlayerId((prev) => {
      const prevPlayerIds = Object.keys(prev);
      const nextPlayerIds = Object.keys(nextPublicChargesByPlayerId);
      let hasChange = prevPlayerIds.length !== nextPlayerIds.length;

      if (!hasChange) {
        for (const playerId of nextPlayerIds) {
          const prevCharges = prev[playerId] ?? {};
          const nextCharges = nextPublicChargesByPlayerId[playerId] ?? {};
          const prevEntries = Object.entries(prevCharges);
          const nextEntries = Object.entries(nextCharges);

          if (prevEntries.length !== nextEntries.length) {
            hasChange = true;
            break;
          }

          for (const [instanceId, charges] of nextEntries) {
            if (prevCharges[instanceId] !== charges) {
              hasChange = true;
              break;
            }
          }

          if (hasChange) {
            break;
          }
        }
      }

      return hasChange ? nextPublicChargesByPlayerId : prev;
    });
  }, [
    allPlayers,
    effectiveGameId,
    hasMatchingAuthoritativeGameId,
    isBootstrapping,
    majorPhase,
    rawState,
    turnNumber,
  ]);

  const {
    allocatedDestroyTargetIdBySourceInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    destroyTargetSatisfiedBySourceInstanceId,
    boardDestroyTargeting,
    shouldResetDestroyTargetRows,
    consumePendingDestroyTargetReset,
    applyDestroyTargetingChoiceSideEffects,
    onBoardBackgroundMouseDown: handleDestroyTargetingBoardBackgroundMouseDown,
    onDestroyTargetStackHoverChange: handleDestroyTargetStackHoverChange,
    onDestroyTargetStackMouseDown: handleDestroyTargetStackMouseDown,
  } = useDestroyTargetingRuntime({
    phaseKey,
    phaseInstanceKey,
    availableActions,
    shipChoiceSelectionByInstanceId,
    myPlayerId: me?.id,
    opponentPlayerId: opponent?.id,
    myShips,
    opponentShipsVisible,
    frigateTriggerByInstanceId: frigateTriggerByInstanceId as Record<string, number>,
    ...(isMixedFirstStrike
      ? {
          activeFirstStrikeFamily: storedFirstStrikeTargetingFamily,
          firstStrikeFamilyRankByFamily,
        }
      : {}),
  });

  const effectiveMixedFirstStrikeFamily = isMixedFirstStrike
    ? (
        orderedFirstStrikeFamilies.find((family) =>
          family !== 'guardian' &&
          firstStrikeClassification.supportedActionsByFamily[family].some(
            (action) =>
              destroyTargetSatisfiedBySourceInstanceId[action.sourceInstanceId] !== true
          )
        ) ??
        (
          firstStrikeClassification.supportedActionsByFamily.guardian.length > 0
            ? 'guardian'
            : null
        )
      )
    : null;
  const routedFirstStrikeFamily =
    phaseKey !== 'battle.first_strike'
      ? null
      : isMixedFirstStrike
        ? effectiveMixedFirstStrikeFamily
        : firstStrikeClassification.supportedFamilies[0] ?? null;
  const firstStrikeHandoffTransitionPending =
    isMixedFirstStrike &&
    storedFirstStrikeTargetingFamily !== effectiveMixedFirstStrikeFamily;
  const effectiveMandatoryFirstStrikeFamilyIsUnresolved =
    isMixedFirstStrike &&
    effectiveMixedFirstStrikeFamily != null &&
    FIRST_STRIKE_MANDATORY_FAMILIES.includes(effectiveMixedFirstStrikeFamily) &&
    firstStrikeClassification.supportedActionsByFamily[
      effectiveMixedFirstStrikeFamily
    ].some(
      (action) =>
        destroyTargetSatisfiedBySourceInstanceId[action.sourceInstanceId] !== true
    );

  useEffect(() => {
    if (!isMixedFirstStrike) {
      setMixedFirstStrikeHandoffState((current) =>
        current == null ? current : null
      );
      return;
    }

    setMixedFirstStrikeHandoffState((current) => {
      if (
        current?.phaseInstanceKey === phaseInstanceKey &&
        current.activeFamily === effectiveMixedFirstStrikeFamily &&
        current.orderedFamilies.join('|') === orderedFirstStrikeFamiliesKey
      ) {
        return current;
      }

      return {
        phaseInstanceKey,
        orderedFamilies: orderedFirstStrikeFamilies,
        activeFamily: effectiveMixedFirstStrikeFamily,
      };
    });
  }, [
    effectiveMixedFirstStrikeFamily,
    isMixedFirstStrike,
    orderedFirstStrikeFamiliesKey,
    phaseInstanceKey,
  ]);

  // ============================================================================
  // SHIP CHOICE SELECTION EFFECT (maintain defaults for server-choice phases)
  // ============================================================================

  useEffect(() => {
    explicitShipChoiceBySourceRef.current = {};
  }, [phaseInstanceKey]);
  
  useEffect(() => {
    // Only for server-choice phases
    if (
      phaseKey !== 'build.dice_roll' &&
      !(phaseKey === 'build.drawing' && drawingStage.kind === 'prelude') &&
      phaseKey !== 'battle.first_strike' &&
      phaseKey !== 'battle.charge_declaration'
    ) {
      return;
    }
    
    const choiceActions = (
      phaseKey === 'build.drawing'
        ? carrierPreludeActionValidation.ok
          ? carrierPreludeActionValidation.actions
          : []
        : getRenderableServerChoiceActions(phaseKey, availableActions)
    ).filter((action) => getRenderableActionChoiceIds(action).length > 0);
    
    // If server says there are no choice actions, clear our local selection map.
    if (choiceActions.length === 0) {
      setShipChoiceSelectionByInstanceId({});
      return;
    }
    
    // Functional update so we can compare with prev and avoid unnecessary state churn.
    setShipChoiceSelectionByInstanceId((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      
      for (const action of choiceActions) {
        const instanceId = action.sourceInstanceId as string;
        const allowedChoiceIds = getRenderableActionChoiceIds(action);
        
        if (allowedChoiceIds.length === 0) continue;
        
        const existing =
          shouldResetDestroyTargetRows && isRenderableTargetedAction(action)
            ? undefined
            : prev[instanceId];
        if (existing && allowedChoiceIds.includes(existing)) {
          next[instanceId] = existing;
        } else {
          const defaultChoiceId = getDefaultChoiceIdForRenderableAction(action);
          if (!defaultChoiceId) continue;

          next[instanceId] = defaultChoiceId;
          if (prev[instanceId] !== defaultChoiceId) changed = true;
        }
      }
      
      // Also detect removals (prev had keys that are no longer present)
      const prevKeys = Object.keys(prev);
      if (!changed) {
        if (prevKeys.length !== Object.keys(next).length) {
          changed = true;
        } else {
          for (const k of prevKeys) {
            if (prev[k] !== next[k]) {
              changed = true;
              break;
            }
          }
        }
      }
      
      return changed ? next : prev;
    });

    if (shouldResetDestroyTargetRows) {
      consumePendingDestroyTargetReset();
    }
  }, [
    phaseKey,
    availableActions,
    phaseInstanceKey,
    shouldResetDestroyTargetRows,
  ]);
  
  // ============================================================================
  // CHUNK 6: MERGE PREVIEW COUNTS INTO FLEET (ENTIRE BUILD PHASE)
  // ============================================================================
  
  // Determine if we're in build major phase (any build subphase)
  const isInBuildPhase = majorPhase === 'build';
  
  // ============================================================================
  // CHUNK 6.1: RESET PREVIEW BUFFER ON TURN TRANSITION
  // ============================================================================
  
  // Reset preview buffer when:
  // - turnNumber changes (new turn begins)
  // - effectiveGameId changes (switched games)
  // 
  // IMPORTANT: We must NOT reset on phaseKey changes because the server owns
  // Drawing workflow progress and the preview persists until the turn changes.
  // 
  // This effect does NOT depend on buildPreviewCounts (avoids noise)
  useBuildPreviewResetEffect({
    turnNumber,
    effectiveGameId,
    setBuildPreviewCounts,
  });
  
  // Keep ref aligned with state reset (same deps as useBuildPreviewResetEffect)
  useEffect(() => {
    buildPreviewCountsRef.current = {};
    buildPreviewTurnNumberRef.current = null;
  }, [turnNumber, effectiveGameId]);

// Keep Frigate trigger selections ref in sync
useEffect(() => {
  frigateSelectedTriggersRef.current = frigateSelectedTriggers;
  frigatePreviewTriggerByRowIdRef.current = buildDraftPreviewFrigateTriggerByRowId(
    turnNumber,
    frigateSelectedTriggers
  );
}, [frigateSelectedTriggers, turnNumber]);

useEffect(() => {
  quantumMysticSelectedNumbersRef.current = quantumMysticSelectedNumbers;
  quantumMysticPreviewNumberByRowIdRef.current = buildDraftPreviewQuantumMysticNumberByRowId(
    turnNumber,
    quantumMysticSelectedNumbers
  );
}, [quantumMysticSelectedNumbers, turnNumber]);

useEffect(() => {
  evolverChoicesByRowIdRef.current = evolverChoicesByRowId;
}, [evolverChoicesByRowId]);

// Ensure frigateSelectedTriggers length matches build preview FRI count (default new entries to 1)
useEffect(() => {
  const activeBuildPreviewCountsRef = getActiveBuildPreviewCountsRefForTurn(turnNumber);
  const friCount = Number.isInteger(activeBuildPreviewCountsRef?.FRI)
    ? Math.max(0, activeBuildPreviewCountsRef.FRI)
    : 0;

  setFrigateSelectedTriggers(prev => {
    if (prev.length === friCount) return prev;
    const next = prev.slice(0, friCount);
    while (next.length < friCount) next.push(1);
    frigateSelectedTriggersRef.current = next;
    frigatePreviewTriggerByRowIdRef.current = buildDraftPreviewFrigateTriggerByRowId(turnNumber, next);
    return next;
  });
}, [buildPreviewCounts, getActiveBuildPreviewCountsRefForTurn, turnNumber]);

useEffect(() => {
  const activeBuildPreviewCountsRef = getActiveBuildPreviewCountsRefForTurn(turnNumber);
  const quantumMysticCount = Number.isInteger(activeBuildPreviewCountsRef?.QUA)
    ? Math.max(0, activeBuildPreviewCountsRef.QUA)
    : 0;

  setQuantumMysticSelectedNumbers((previousSelections) => {
    if (previousSelections.length === quantumMysticCount) return previousSelections;
    const nextSelections = previousSelections.slice(0, quantumMysticCount);
    while (nextSelections.length < quantumMysticCount) nextSelections.push(1);
    quantumMysticSelectedNumbersRef.current = nextSelections;
    quantumMysticPreviewNumberByRowIdRef.current = buildDraftPreviewQuantumMysticNumberByRowId(
      turnNumber,
      nextSelections
    );
    return nextSelections;
  });
}, [buildPreviewCounts, getActiveBuildPreviewCountsRefForTurn, turnNumber]);

  useEffect(() => {
    setEvolverChoicesByRowId({});
    evolverChoicesByRowIdRef.current = {};
  }, [turnNumber, effectiveGameId]);

  const isLocalBuildDrawing = phaseKey === 'build.drawing' && myRole === 'player';
  const buildEconomyForMeRead = readBuildEconomyForPlayer(rawState, me?.id);
  const buildEconomyForMe = buildEconomyForMeRead.present
    ? buildEconomyForMeRead.value
    : null;
  const normalizedBuildDrawingEconomyForDisplay =
    isLocalBuildDrawing &&
    (drawingStage.kind === 'prelude' || canEditCurrentDrawingBuild) &&
    buildEconomyForMeRead.present
      ? normalizeBuildEconomyForDisplay(buildEconomyForMeRead.value)
      : null;
  const buildEconomyForMeDisplay = (() => {
    if (!isLocalBuildDrawing) {
      buildDrawingEconomyContinuityRef.current = null;
      return null;
    }

    if (normalizedBuildDrawingEconomyForDisplay != null) {
      buildDrawingEconomyContinuityRef.current = {
        phaseInstanceKey,
        economy: normalizedBuildDrawingEconomyForDisplay,
      };
      return normalizedBuildDrawingEconomyForDisplay;
    }

    return buildDrawingEconomyContinuityRef.current?.phaseInstanceKey === phaseInstanceKey
      ? buildDrawingEconomyContinuityRef.current.economy
      : null;
  })();
  const ownedForeignSpeciesSet = useMemo(() => {
    const nextOwnedForeignSpecies = new Set<SpeciesId>();

    for (const ship of myShips) {
      const rawShipDefId = String(ship?.shipDefId ?? '');
      if (!isShipDefId(rawShipDefId)) {
        continue;
      }

      const def = getShipDefinitionById(rawShipDefId);
      const shipSpecies = normalizeSpecies(def?.species);
      if (shipSpecies == null || shipSpecies === mySpecies) {
        continue;
      }

      nextOwnedForeignSpecies.add(shipSpecies);
    }

    return nextOwnedForeignSpecies;
  }, [myShips, mySpecies]);
  const frigateSelectedTriggersForPreview = frigateSelectedTriggersRef.current;
  const frigatePreviewTriggerByRowIdForPreview = frigatePreviewTriggerByRowIdRef.current;
  const quantumMysticSelectedNumbersForPreview = quantumMysticSelectedNumbersRef.current;
  const quantumMysticPreviewNumberByRowIdForPreview = quantumMysticPreviewNumberByRowIdRef.current;

  const provisionalBuild = evaluateProvisionalBuild({
    turnNumber,
    myShips,
    draftCounts: activeBuildPreviewCounts,
    nativeSpecies: mySpecies,
    buildEconomy: buildEconomyForMe,
    // Use the ref-backed snapshot so same-click preview rerenders see the latest trigger choice.
    frigateSelectedTriggers: frigateSelectedTriggersForPreview,
    frigatePreviewTriggerByRowId: frigatePreviewTriggerByRowIdForPreview,
    quantumMysticSelectedNumbers: quantumMysticSelectedNumbersForPreview,
    quantumMysticPreviewNumberByRowId: quantumMysticPreviewNumberByRowIdForPreview,
    evolverChoicesByRowId,
    frigateTriggerByInstanceId,
  });

  const zeroAncientCatalogueEnergyPool = {
    green: 0,
    red: 0,
    blue: 0,
  } as const;
  const authoritativeAncientCoreCounts = myShips.reduce(
    (counts, ship) => {
      switch (ship?.shipDefId) {
        case 'PLU':
          counts.green += 1;
          break;
        case 'MER':
          counts.red += 1;
          break;
        case 'NEP':
          counts.blue += 1;
          break;
      }
      return counts;
    },
    { green: 0, red: 0, blue: 0 }
  );
  const ancientCatalogueEnergy: AncientCatalogueEnergyDisplay = (() => {
    const hasOwnAncientEnergyContext =
      myRole === 'player' &&
      mySpecies === 'ancient' &&
      !isBootstrapping &&
      !isFinished &&
      hasValidPhaseKey;

    if (!hasOwnAncientEnergyContext) {
      return {
        mode: 'reference',
        pool: zeroAncientCatalogueEnergyPool,
        capacity: zeroAncientCatalogueEnergyPool,
      };
    }

    if (majorPhase === 'battle' && phaseKey.startsWith('battle.')) {
      return {
        mode: 'active',
        pool: authoritativeAncientEnergy,
        capacity: authoritativeAncientEnergyCapacity,
      };
    }

    if (phaseKey === 'build.drawing') {
      const pool = {
        green: provisionalBuild.provisionalShipCountsById.PLU ?? 0,
        red: provisionalBuild.provisionalShipCountsById.MER ?? 0,
        blue: provisionalBuild.provisionalShipCountsById.NEP ?? 0,
      };
      return {
        mode: 'dormant',
        pool,
        capacity: pool,
      };
    }

    if (majorPhase === 'build' && phaseKey.startsWith('build.')) {
      return {
        mode: 'dormant',
        pool: authoritativeAncientCoreCounts,
        capacity: authoritativeAncientCoreCounts,
      };
    }

    return {
      mode: 'reference',
      pool: zeroAncientCatalogueEnergyPool,
      capacity: zeroAncientCatalogueEnergyPool,
    };
  })();

  const evolverRowIds = provisionalBuild.evolverRowIds;
  const evolverRowIdsSet = new Set(evolverRowIds);
  const evolverRowIdsKey = Array.from(evolverRowIdsSet).sort().join('|');
  const evolverChoiceSourceRowIds = provisionalBuild.evolverChoiceSourceRowIds;
  const evolverChoiceSourceRowIdsSet = new Set(evolverChoiceSourceRowIds);
  const evolverChoiceSourceRowIdsKey = Array.from(evolverChoiceSourceRowIdsSet).sort().join('|');
  const displayProvisionalBuild =
    isLocalBuildDrawing && buildEconomyForMeDisplay != null
      ? evaluateProvisionalBuild({
          turnNumber,
          myShips,
          draftCounts: activeBuildPreviewCounts,
          nativeSpecies: mySpecies,
          buildEconomy: buildEconomyForMeDisplay,
          frigateSelectedTriggers: frigateSelectedTriggersForPreview,
          frigatePreviewTriggerByRowId: frigatePreviewTriggerByRowIdForPreview,
          quantumMysticSelectedNumbers: quantumMysticSelectedNumbersForPreview,
          quantumMysticPreviewNumberByRowId: quantumMysticPreviewNumberByRowIdForPreview,
          evolverChoicesByRowId,
          frigateTriggerByInstanceId,
        })
      : null;
  const buildDrawingEconomyDisplay = displayProvisionalBuild != null
    ? {
        ordinaryAvailable: displayProvisionalBuild.remainingOrdinaryLines,
        joiningAvailable: displayProvisionalBuild.remainingJoiningLines,
        projectedSavedOrdinary: displayProvisionalBuild.projectedSavedOrdinaryLines,
        projectedSavedJoining: displayProvisionalBuild.projectedSavedJoiningLines,
        projectedSavedCombined: displayProvisionalBuild.projectedSavedCombinedLines,
        projectedSavedWasCapped: displayProvisionalBuild.projectedSavedWasCapped,
      }
    : null;
  const committedDrawingProjection =
    hasAuthoritativeDrawingCommitment &&
    committedDrawingProjectionRef.current?.key === committedDrawingProjectionKey
      ? {
          ordinary: committedDrawingProjectionRef.current.ordinary,
          joining: committedDrawingProjectionRef.current.joining,
        }
      : null;

  useEffect(() => {
    setEvolverChoicesByRowId((prev) => {
      const next: Record<string, EvolverChoiceId> = {};
      let changed = evolverChoiceSourceRowIds.length !== Object.keys(prev).length;

      for (const rowId of evolverChoiceSourceRowIds) {
        const choiceId = prev[rowId] ?? 'hold';
        next[rowId] = choiceId;
        if (prev[rowId] !== choiceId) {
          changed = true;
        }
      }

      if (!changed) {
        for (const key of Object.keys(prev)) {
          if (!evolverChoiceSourceRowIdsSet.has(key)) {
            changed = true;
            break;
          }
        }
      }

      if (!changed) {
        evolverChoicesByRowIdRef.current = prev;
        return prev;
      }

      evolverChoicesByRowIdRef.current = next;
      return next;
    });
  }, [evolverChoiceSourceRowIdsKey]);

  // ============================================================================
  // CHUNK 6.2: AUTO-SUBMIT BUILD_REVEAL WHEN ENTERING BATTLE.REVEAL PHASE
  // ============================================================================
  
  // REMOVED: Build reveal automation removed in favor of BUILD_SUBMIT
  // BUILD_SUBMIT is applied during build.drawing phase only
  
  // Check if build reveal is done for this phase instance
  const buildRevealDoneThisPhase = !!buildRevealDoneByPhase[buildServerKey];
  
  // ============================================================================
  // B3) STABLE PREVIEW OVERLAY RULE (SIMPLIFIED)
  // ============================================================================
  
  // Single derived rule for preview display:
  // - If majorPhase === 'build': Display requester-only provisional fleet preview
  // - Else: Display serverFleet only
  
  const shouldShowPreview = majorPhase === 'build' && me?.role === 'player';
  const shouldHandoffPreviewFleetToAuthoritative =
    prevShouldShowPreviewRef.current && !shouldShowPreview;

  const mySemanticFleetForBoard: BoardFleetSummary[] = shouldShowPreview
    ? provisionalBuild.myFleetPreview
    : displayLeftFleet;

  const myFleetWithPreview: BoardFleetSummary[] = reconcileFleetRenderKeys(
    mySemanticFleetForBoard,
    prevMyRenderedFleetRef.current,
    shouldHandoffPreviewFleetToAuthoritative &&
      lastCommittedPreviewRenderedMyFleetRef.current.length > 0
      ? {
          previewToAuthoritativeHandoffFleet:
            lastCommittedPreviewRenderedMyFleetRef.current,
        }
      : undefined
  );
  const opponentFleetRendered: BoardFleetSummary[] = reconcileFleetRenderKeys(
    displayRightFleet,
    prevOpponentRenderedFleetRef.current
  );
  const persistentAncientSolarTargetMarkers =
    buildPersistentAncientSolarTargetMarkers({
      active: showAncientSolarTargetMarkers,
      solarEntries: ancientSolarEntriesForMarkers,
      myFleet: myFleetWithPreview,
      opponentFleet: opponentFleetRendered,
    });
  const baseBoardDestroyTargeting = ancientBlackHoleSelectorActive
    ? ancientBlackHoleBoardTargeting
    : ancientSimulacrumSelectorActive
      ? ancientSimulacrumBoardTargeting
      : boardDestroyTargeting;
  const boardDestroyTargetingWithAncientSolarMarkers =
    overlayAncientSolarTargetMarkers({
      activeTargeting: baseBoardDestroyTargeting,
      persistentMarkers: persistentAncientSolarTargetMarkers,
    });
  
  // ============================================================================
  // FLEET ORDER HOOK (UI-only stable ordering, append-only)
  // ============================================================================
  
  const myFleetRenderKeys = myFleetWithPreview.map((summary) => summary.renderKey);
  const opponentFleetRenderKeys = opponentFleetRendered.map((summary) => summary.renderKey);

  const { myFleetRenderOrder, opponentFleetRenderOrder } = useFleetOrder({
    myFleetRenderKeys,
    opponentFleetRenderKeys,
  });

  useLayoutEffect(() => {
    const orderedMyRenderedFleet = orderFleetSummariesByRenderKey(
      myFleetWithPreview,
      myFleetRenderOrder
    );
    prevMyRenderedFleetRef.current = orderedMyRenderedFleet;

    if (shouldShowPreview) {
      lastCommittedPreviewRenderedMyFleetRef.current = orderedMyRenderedFleet;
    }

    prevShouldShowPreviewRef.current = shouldShowPreview;
  }, [myFleetWithPreview, myFleetRenderOrder, shouldShowPreview]);

  useLayoutEffect(() => {
    prevOpponentRenderedFleetRef.current = orderFleetSummariesByRenderKey(
      opponentFleetRendered,
      opponentFleetRenderOrder
    );
  }, [opponentFleetRendered, opponentFleetRenderOrder]);

  // ============================================================================
  // FLEET ANIMATION TOKENS (client-only; extracted from useGameSession)
  // ============================================================================
  
  // Existing rendered stacks can still animate immediately on local build when
  // we can identify the exact currently-visible bucket that will grow.
  // Otherwise we fall back to the normal diff-owned path on the next render.
  function getExistingRenderKeyForLocalBuild(
    shipDefId: string,
    myRenderedFleet: Array<{ shipDefId: string; stackKey: string; renderKey: string }>
  ): string | null {
    const chargedKey = `${shipDefId}__charges_1`;
    const charged = myRenderedFleet.find((summary) => summary.stackKey === chargedKey);
    if (charged) {
      return charged.renderKey;
    }

    const unsplit = myRenderedFleet.find((summary) => summary.stackKey === shipDefId);
    return unsplit?.renderKey ?? null;
  }
  
  // Build count maps for the token hook (server fleet + preview overlay for "me")
  const myCountsByRenderKey: Record<string, number> = {};
  for (const entry of myFleetWithPreview) myCountsByRenderKey[entry.renderKey] = entry.count;

  const opponentCountsByRenderKey: Record<string, number> = {};
  for (const entry of opponentFleetRendered) opponentCountsByRenderKey[entry.renderKey] = entry.count;

  const rawActivationCueBatches =
    rawState && hasMatchingAuthoritativeGameId && !isBootstrapping
      ? getShipActivationCueBatches(rawState)
      : null;
  const myRenderKeyByInstanceId = new Map<string, string>();
  for (const summary of myFleetWithPreview) {
    for (const instanceId of summary.memberInstanceIds) {
      myRenderKeyByInstanceId.set(instanceId, summary.renderKey);
    }
  }
  const opponentRenderKeyByInstanceId = new Map<string, string>();
  for (const summary of opponentFleetRendered) {
    for (const instanceId of summary.memberInstanceIds) {
      opponentRenderKeyByInstanceId.set(instanceId, summary.renderKey);
    }
  }

  const displayLeftPlayerId = getPlayerIdentityKey(displayLeftPlayer);
  const displayRightPlayerId = getPlayerIdentityKey(displayRightPlayer);
  const resolvedActivationEvents: ResolvedFleetActivationEvent[] | null =
    rawActivationCueBatches?.flatMap((batch) =>
      batch.sources.map((source): ResolvedFleetActivationEvent => {
        const eventKey =
          `${batch.key}\0${source.playerId}\0${source.sourceInstanceId}`;

        if (source.playerId === displayLeftPlayerId) {
          return {
            eventKey,
            side: 'my',
            renderKey: myRenderKeyByInstanceId.get(source.sourceInstanceId),
          };
        }

        if (source.playerId === displayRightPlayerId) {
          return {
            eventKey,
            side: 'opponent',
            renderKey: opponentRenderKeyByInstanceId.get(source.sourceInstanceId),
          };
        }

        return { eventKey, side: null };
      })
    ) ?? null;

  const { myAnimTokens, opponentAnimTokens, bumpMyStackAdd } = useFleetAnimTokens({
    myCountsByRenderKey,
    opponentCountsByRenderKey,
    activationEvents: resolvedActivationEvents,
    activationHardContinuityKey,
  });

  

  // ============================================================================
  // BOARD MODE + COMPLETION TRACKING (ME/OPPONENT)
  // ============================================================================
  
  // Check completion status for this phase instance
  const isCommitDone = speciesCommitDoneByPhase[phaseInstanceKey] || false;
  const isRevealDone = speciesRevealDoneByPhase[phaseInstanceKey] || false;
  const isSpeciesSelectionComplete = isCommitDone && isRevealDone;
  const activePendingSpeciesConfirmation =
    isInSpeciesSelection && pendingSpeciesConfirmation?.entryKey === speciesSelectionEntryKey
      ? pendingSpeciesConfirmation
      : null;
  const speciesConfirmationPending = activePendingSpeciesConfirmation !== null;
  const speciesControlsLocked = isSpeciesSelectionComplete || speciesConfirmationPending;
  const isSpeciesConfirmedForDisplay =
    isSpeciesSelectionComplete ||
    Boolean(activePendingSpeciesConfirmation?.isComputerGame);

  // Compute board mode based on server phase
  let board: BoardViewModel;

  if (isInSpeciesSelection) {
    // Choose species mode
    const shareGameUrl = effectiveGameId ? buildShareGameUrl(effectiveGameId) : '';

    // Determine if Confirm button should be enabled
    // Strict gating: requires phase, player role, and active status
    const canConfirmSpecies =
      !speciesControlsLocked &&
      myRole === 'player' &&
      me?.isActive === true;

    const confirmDisabledReason =
      myRole !== 'player' ? 'Two players already present. You are spectating.' :
      me?.isActive !== true ? 'Inactive player cannot confirm' :
      isSpeciesSelectionComplete ? 'Already confirmed' :
      undefined;

    board = {
      mode: 'choose_species',
      selectedSpecies,
      isComputerGame,
      selectedBotSpecies,
      gameUrl: shareGameUrl,
      isSpectator: isViewerSpectator,
      canConfirmSpecies,
      isSpeciesSelectionComplete,
      speciesConfirmationPending,
      submittedSpecies: activePendingSpeciesConfirmation?.submittedSpecies ?? null,
      speciesControlsLocked,
      isSpeciesConfirmedForDisplay,
      confirmDisabledReason,
    };
  } else {
    // Normal board mode (REAL DATA WIRING)
    const effectiveMySpecies: SpeciesId = displayLeftSpecies ?? 'human';
    const effectiveOpponentSpecies: SpeciesId = displayRightSpecies ?? 'human';
    const displayLeftPlayerId = displayLeftPlayer?.id ?? null;
    const displayRightPlayerId = displayRightPlayer?.id ?? null;

    // Extract server-authoritative health
    const myHealth = typeof displayLeftPlayer?.health === 'number' ? displayLeftPlayer.health : 25;
    const opponentHealth = typeof displayRightPlayer?.health === 'number' ? displayRightPlayer.health : 25;
    const myMaxHealth = normalizeProjectedMaxHealth(displayLeftPlayer?.maxHealth);
    const opponentMaxHealth = normalizeProjectedMaxHealth(displayRightPlayer?.maxHealth);

    // Extract server-authoritative deltas (last turn heal/damage/net)
    const lastTurnHealById = getLastTurnHealByPlayerId(rawState) as Record<string, number> | undefined;
    const lastTurnDamageById = getLastTurnDamageByPlayerId(rawState) as Record<string, number> | undefined;
    const lastTurnNetById = getLastTurnNetByPlayerId(rawState) as Record<string, number> | undefined;

    const fallbackMyLastTurnHeal = displayLeftPlayerId ? (lastTurnHealById?.[displayLeftPlayerId] ?? 0) : 0;
    // NOTE: server lastTurnDamageByPlayerId is damage TAKEN (target).
    // UI "Damage" row is damage DEALT, so we swap sides:
    const fallbackMyLastTurnDamage = displayRightPlayerId ? (lastTurnDamageById?.[displayRightPlayerId] ?? 0) : 0;
    const myLastTurnNet = displayLeftPlayerId ? (lastTurnNetById?.[displayLeftPlayerId] ?? 0) : 0;

    const fallbackOpponentLastTurnHeal = displayRightPlayerId ? (lastTurnHealById?.[displayRightPlayerId] ?? 0) : 0;
    const fallbackOpponentLastTurnDamage = displayLeftPlayerId ? (lastTurnDamageById?.[displayLeftPlayerId] ?? 0) : 0;
    const opponentLastTurnNet = displayRightPlayerId ? (lastTurnNetById?.[displayRightPlayerId] ?? 0) : 0;
    const lastTurnDamageDealtBreakdownById = getLastTurnDamageDealtBreakdownByPlayerId(rawState);
    const lastTurnHealingReceivedBreakdownById = getLastTurnHealingReceivedBreakdownByPlayerId(rawState);
    const myLastDamageBreakdownRows = displayLeftPlayerId
      ? normalizeBoardStatBreakdownRows(lastTurnDamageDealtBreakdownById?.[displayLeftPlayerId])
      : [];
    const opponentLastDamageBreakdownRows = displayRightPlayerId
      ? normalizeBoardStatBreakdownRows(lastTurnDamageDealtBreakdownById?.[displayRightPlayerId])
      : [];
    const myLastHealingBreakdownRows = displayLeftPlayerId
      ? normalizeBoardStatBreakdownRows(lastTurnHealingReceivedBreakdownById?.[displayLeftPlayerId])
      : [];
    const opponentLastHealingBreakdownRows = displayRightPlayerId
      ? normalizeBoardStatBreakdownRows(lastTurnHealingReceivedBreakdownById?.[displayRightPlayerId])
      : [];
    const myHasHealingBreakdown = displayLeftPlayerId ? Array.isArray(lastTurnHealingReceivedBreakdownById?.[displayLeftPlayerId]) : false;
    const myHasDamageBreakdown = displayLeftPlayerId ? Array.isArray(lastTurnDamageDealtBreakdownById?.[displayLeftPlayerId]) : false;
    const opponentHasDamageBreakdown = displayRightPlayerId
      ? Array.isArray(lastTurnDamageDealtBreakdownById?.[displayRightPlayerId])
      : false;
    const opponentHasHealingBreakdown = displayRightPlayerId
      ? Array.isArray(lastTurnHealingReceivedBreakdownById?.[displayRightPlayerId])
      : false;
    const myLastTurnDamage = myHasDamageBreakdown
      ? sumBoardStatBreakdownRows(myLastDamageBreakdownRows)
      : fallbackMyLastTurnDamage;
    const myLastTurnHeal = myHasHealingBreakdown
      ? sumBoardStatBreakdownRows(myLastHealingBreakdownRows)
      : fallbackMyLastTurnHeal;
    const opponentLastTurnDamage = opponentHasDamageBreakdown
      ? sumBoardStatBreakdownRows(opponentLastDamageBreakdownRows)
      : fallbackOpponentLastTurnDamage;
    const opponentLastTurnHeal = opponentHasHealingBreakdown
      ? sumBoardStatBreakdownRows(opponentLastHealingBreakdownRows)
      : fallbackOpponentLastTurnHeal;
    const activeHealthPresentationOverride =
      healthPresentationBoardOverride &&
      (
        healthPresentationBoardOverride.responseIsFinished
          ? !isFinished
          : turnNumber < healthPresentationBoardOverride.responseTurnNumber
      )
        ? healthPresentationBoardOverride
        : null;

    // Server-authoritative bonus lines (top-level response projection)
    const bonusLinesByPlayerId = getBonusLinesByPlayerId(rawState);
    const bonusLinesOnEvenByPlayerId = getBonusLinesOnEvenByPlayerId(rawState);
    const savedLinesByPlayerId = getSavedLinesByPlayerId(rawState);
    const joiningLinesByPlayerId = getJoiningLinesByPlayerId(rawState);
    const joiningBonusLinesByPlayerId = getJoiningBonusLinesByPlayerId(rawState);
    const bonusBreakdownByPlayerId = getBonusBreakdownByPlayerId(rawState);

    const myBonusLines = displayLeftPlayerId ? (bonusLinesByPlayerId?.[displayLeftPlayerId] ?? 0) : 0;
    const opponentBonusLines = displayRightPlayerId ? (bonusLinesByPlayerId?.[displayRightPlayerId] ?? 0) : 0;
    const myBonusLinesOnEven = displayLeftPlayerId ? (bonusLinesOnEvenByPlayerId?.[displayLeftPlayerId] ?? 0) : 0;
    const opponentBonusLinesOnEven = displayRightPlayerId ? (bonusLinesOnEvenByPlayerId?.[displayRightPlayerId] ?? 0) : 0;
    const readDisplayLineValue = (key: string, read: OwnFiniteNumberRead): number => {
      if (read.present) {
        displayLineContinuityRef.current[key] = read.value;
        return read.value;
      }

      return displayLineContinuityRef.current[key] ?? 0;
    };
    const mySavedLines = displayLeftPlayerId
      ? readDisplayLineValue(
          'left.saved',
          readOwnFiniteNumber(savedLinesByPlayerId, displayLeftPlayerId)
        )
      : 0;
    const opponentSavedLines = displayRightPlayerId
      ? readDisplayLineValue(
          'right.saved',
          readOwnFiniteNumber(savedLinesByPlayerId, displayRightPlayerId)
        )
      : 0;
    const mySavedJoiningLines = displayLeftPlayerId
      ? readDisplayLineValue(
          'left.joining',
          readOwnFiniteNumber(joiningLinesByPlayerId, displayLeftPlayerId)
        )
      : 0;
    const opponentSavedJoiningLines = displayRightPlayerId
      ? readDisplayLineValue(
          'right.joining',
          readOwnFiniteNumber(joiningLinesByPlayerId, displayRightPlayerId)
        )
      : 0;
    const myJoiningBonusLines = displayLeftPlayerId ? (joiningBonusLinesByPlayerId?.[displayLeftPlayerId] ?? 0) : 0;
    const opponentJoiningBonusLines = displayRightPlayerId ? (joiningBonusLinesByPlayerId?.[displayRightPlayerId] ?? 0) : 0;
    const myBonusBreakdownRows = displayLeftPlayerId
      ? normalizeBoardStatBreakdownRows(bonusBreakdownByPlayerId?.[displayLeftPlayerId])
      : [];
    const opponentBonusBreakdownRows = displayRightPlayerId
      ? normalizeBoardStatBreakdownRows(bonusBreakdownByPlayerId?.[displayRightPlayerId])
      : [];
    const myDisplayedSavedLines =
      buildDrawingEconomyDisplay?.ordinaryAvailable ?? mySavedLines;
    const opponentDisplayedSavedLines = opponentSavedLines;
    const myDisplayedSavedJoiningLines =
      buildDrawingEconomyDisplay?.joiningAvailable ?? mySavedJoiningLines;
    const opponentDisplayedSavedJoiningLines = opponentSavedJoiningLines;

    board = {
      mode: 'board',
      mySpeciesId: effectiveMySpecies,
      opponentSpeciesId: effectiveOpponentSpecies,

      turnNumber,

      // Server-authoritative health
      myHealth: activeHealthPresentationOverride?.myHealth ?? myHealth,
      opponentHealth: activeHealthPresentationOverride?.opponentHealth ?? opponentHealth,
      myMaxHealth: activeHealthPresentationOverride?.myMaxHealth ?? myMaxHealth,
      opponentMaxHealth: activeHealthPresentationOverride?.opponentMaxHealth ?? opponentMaxHealth,

      // Fleet data: server + local preview overlay (build phase only)
      myFleet: myFleetWithPreview,
      opponentFleet: opponentFleetRendered,
      myVoidFleet: displayLeftVoidFleet,
      opponentVoidFleet: displayRightVoidFleet,
      myAncientSolarEntries:
        effectiveMySpecies === 'ancient' ? displayLeftAncientSolarEntries : [],
      opponentAncientSolarEntries:
        effectiveOpponentSpecies === 'ancient' ? displayRightAncientSolarEntries : [],

      // UI-only stable ordering (append-only)
      myFleetRenderOrder,
      opponentFleetRenderOrder,
      mobileDiceModifierSlots: {
        top: null,
        bottom: null,
      },
      
      // Animation tokens (client-only)
      fleetAnim: (() => {
        const makeSide = (tokens: Record<string, any>, fleet: BoardFleetSummary[]) => {
          const out: any = {};
          for (const s of fleet) {
            const t = tokens[s.renderKey];
            if (!t) continue;
            out[s.renderKey] = {
              ...t,
              stackCount: s.count,
            };
          }
          return out;
        };

        return {
          my: makeSide(myAnimTokens, myFleetWithPreview),
          opponent: makeSide(opponentAnimTokens, opponentFleetRendered),
        };
      })(),

      // Last turn deltas (server-authoritative)
      myLastTurnHeal: activeHealthPresentationOverride?.myLastTurnHeal ?? myLastTurnHeal,
      myLastTurnDamage: activeHealthPresentationOverride?.myLastTurnDamage ?? myLastTurnDamage,
      myLastTurnNet: activeHealthPresentationOverride?.myLastTurnNet ?? myLastTurnNet,
      opponentLastTurnHeal: activeHealthPresentationOverride?.opponentLastTurnHeal ?? opponentLastTurnHeal,
      opponentLastTurnDamage: activeHealthPresentationOverride?.opponentLastTurnDamage ?? opponentLastTurnDamage,
      opponentLastTurnNet: activeHealthPresentationOverride?.opponentLastTurnNet ?? opponentLastTurnNet,
      myLastDamageBreakdownRows,
      opponentLastDamageBreakdownRows,
      myLastHealingBreakdownRows,
      opponentLastHealingBreakdownRows,

      // Bonus lines (server-authoritative)
      myBonusLines,
      opponentBonusLines,
      myBonusLinesOnEven,
      opponentBonusLinesOnEven,
      myDisplayedSavedLines,
      opponentDisplayedSavedLines,
      myDisplayedSavedJoiningLines,
      opponentDisplayedSavedJoiningLines,
      mySavedJoiningLines,
      opponentSavedJoiningLines,
      myJoiningBonusLines,
      opponentJoiningBonusLines,
      myBonusBreakdownRows,
      opponentBonusBreakdownRows,

      // Compute activation stagger plan
      activationStaggerPlan: computeActivationStaggerPlan(
        myFleetRenderOrder,
        opponentFleetRenderOrder
      ),

      presentedMyRevealBlurSeq: isViewerSpectator ? presentedOpponentRevealBlurSeq : 0,
      presentedOpponentRevealBlurSeq,

      destroyTargeting: boardDestroyTargetingWithAncientSolarMarkers,
    };
  }

  const rawPhaseHold = getPhaseHold(rawState);
  const authoritativeHoldPhaseKey =
    rawPhaseHold && typeof rawPhaseHold === 'object' && typeof rawPhaseHold.phaseKey === 'string'
      ? rawPhaseHold.phaseKey
      : null;
  const authoritativeHoldReason =
    rawPhaseHold && typeof rawPhaseHold === 'object' && typeof rawPhaseHold.holdReason === 'string'
      ? rawPhaseHold.holdReason
      : null;
  const authoritativeHoldUntilMs =
    rawPhaseHold && typeof rawPhaseHold === 'object' && typeof rawPhaseHold.holdUntilMs === 'number'
      ? rawPhaseHold.holdUntilMs
      : null;
  const spectatorLeftPlayer = displayLeftPlayer;
  const spectatorRightPlayer = displayRightPlayer;
  const lastTurnNetByPlayerId =
    rawState?.gameData?.lastTurnNetByPlayerId as Record<string, unknown> | undefined;
  const spectatorLeftIdentityKey =
    spectatorLeftPlayer?.id ?? spectatorLeftPlayer?.playerId ?? spectatorLeftPlayer?.sessionId ?? null;
  const spectatorRightIdentityKey =
    spectatorRightPlayer?.id ?? spectatorRightPlayer?.playerId ?? spectatorRightPlayer?.sessionId ?? null;
  const spectatorLeftName = spectatorLeftPlayer?.name ?? 'Player 1';
  const spectatorRightName = spectatorRightPlayer?.name ?? 'Player 2';
  const spectatorLeftNetRead = readOwnFiniteNumber(lastTurnNetByPlayerId, spectatorLeftIdentityKey);
  const spectatorRightNetRead = readOwnFiniteNumber(lastTurnNetByPlayerId, spectatorRightIdentityKey);
  const spectatorLeftNet = spectatorLeftNetRead.present ? spectatorLeftNetRead.value : 0;
  const spectatorRightNet = spectatorRightNetRead.present ? spectatorRightNetRead.value : 0;
  const healthResolutionMyLastTurnNet = board.mode === 'board' ? board.myLastTurnNet : 0;
  const healthResolutionOpponentLastTurnNet = board.mode === 'board' ? board.opponentLastTurnNet : 0;
  const healthResolutionMyHealth = board.mode === 'board' ? board.myHealth : 0;
  const healthResolutionOpponentHealth = board.mode === 'board' ? board.opponentHealth : 0;
  const healthResolutionMyMaxHealth = board.mode === 'board' ? board.myMaxHealth : DEFAULT_MAX_HEALTH;
  const healthResolutionOpponentMaxHealth = board.mode === 'board' ? board.opponentMaxHealth : DEFAULT_MAX_HEALTH;
  const healthResolutionHasExplicitProjectedMaxHealth =
    board.mode === 'board' &&
    readExplicitProjectedMaxHealth(displayLeftPlayer?.maxHealth).present &&
    readExplicitProjectedMaxHealth(displayRightPlayer?.maxHealth).present;
  const spectatorHasTwoPlayers = isViewerSpectator && displayLeftPlayer != null && displayRightPlayer != null;
  const healthResolutionViewerRole: 'player' | 'spectator' | 'unknown' =
    me?.role === 'player' || me?.role === 'spectator'
      ? me.role
      : myRole;
  const endOfTurnHealthPresentationInput = useMemo<EndOfTurnHealthPresentationInput>(
    () => ({
      boardMode: board.mode,
      viewerRole: healthResolutionViewerRole,
      meName: displayLeftPlayer?.name ?? 'Player 1',
      opponentName: displayRightPlayer?.name ?? 'Player 2',
      myHealth: healthResolutionMyHealth,
      opponentHealth: healthResolutionOpponentHealth,
      myMaxHealth: healthResolutionMyMaxHealth,
      opponentMaxHealth: healthResolutionOpponentMaxHealth,
      hasExplicitProjectedMaxHealth: healthResolutionHasExplicitProjectedMaxHealth,
      myLastTurnNet: healthResolutionMyLastTurnNet,
      opponentLastTurnNet: healthResolutionOpponentLastTurnNet,
      spectatorHasTwoPlayers,
      spectatorLeftName,
      spectatorRightName,
      spectatorLeftNet,
      spectatorRightNet,
    }),
    [
      board.mode,
      healthResolutionViewerRole,
      displayLeftPlayer?.name,
      displayRightPlayer?.name,
      healthResolutionMyHealth,
      healthResolutionOpponentHealth,
      healthResolutionMyMaxHealth,
      healthResolutionOpponentMaxHealth,
      healthResolutionHasExplicitProjectedMaxHealth,
      healthResolutionMyLastTurnNet,
      healthResolutionOpponentLastTurnNet,
      spectatorHasTwoPlayers,
      spectatorLeftName,
      spectatorRightName,
      spectatorLeftNet,
      spectatorRightNet,
    ]
  );
  const endOfTurnLeftRailInput = useMemo<EndOfTurnLeftRailInput>(
    () => ({
      authoritativeDiceValue,
      authoritativeDiceSignature: authoritativeMainLeftRailDiceSignature,
      hasChronoswarmDice: hasAuthoritativeChronoswarmDice,
    }),
    [
      authoritativeDiceValue,
      authoritativeMainLeftRailDiceSignature,
      hasAuthoritativeChronoswarmDice,
    ]
  );
  const {
    healthResolutionLockActive,
    healthResolutionOverlay,
    myFleetHealthDeltaFlash,
    opponentFleetHealthDeltaFlash,
    healthDeltaPresentationKey,
    leftRailDiceValue: presentedLeftRailDiceValue,
    leftRailDiceAnimateKey: presentedLeftRailDiceAnimateSeq,
    leftRailChronoswarmAnimateKey: presentedChronoswarmAnimateSeq,
    leftRailCubeAnimateKey: presentedCubeAnimateSeq,
    presentedTurnReleaseKey,
    presentedTurnReleaseTurnNumber,
  } = useEndOfTurnPresentation({
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
    healthPresentation: endOfTurnHealthPresentationInput,
    leftRail: endOfTurnLeftRailInput,
    boardFlashEnabled,
    continueAuthoritativePhaseHold,
  });
  const healthResolutionPresentationActive =
    healthResolutionLockActive || healthResolutionOverlay != null;

  useLayoutEffect(() => {
    if (
      !effectiveGameId ||
      (typeof rawState?.gameId === 'string' && rawState.gameId !== effectiveGameId) ||
      isBootstrapping ||
      !hasValidPhaseKey
    ) {
      return;
    }

    const isBattlePhase = phaseKey.startsWith('battle.');

    if (seededBattleRevealGameIdRef.current !== effectiveGameId) {
      seededBattleRevealGameIdRef.current = effectiveGameId;
      lastPresentedBattleRevealTurnRef.current = isBattlePhase ? turnNumber : null;
      return;
    }

    if (!isBattlePhase) {
      return;
    }

    if (lastPresentedBattleRevealTurnRef.current === turnNumber) {
      return;
    }

    lastPresentedBattleRevealTurnRef.current = turnNumber;
    setPresentedOpponentRevealBlurSeq((prev) => prev + 1);
  }, [effectiveGameId, hasValidPhaseKey, isBootstrapping, phaseKey, rawState?.gameId, turnNumber]);
  
  // ============================================================================
  // SPECIES TAB RULES (A-C: Selection phase vs locked-in phase)
  // ============================================================================
  
  // Map species to canonical catalog panel ID
  
  // Map phase + species to action panel ID (UI routing for ship choice panels)
  function phaseToActionPanelId(
    phaseKey: string,
    mySpecies: SpeciesId | null,
    availableActionsForPhase: any[] | null | undefined,
    activeBuildDrawingFamily: BuildDrawingActionFamily | null,
    activeFirstStrikeFamily: FirstStrikeActionFamily | null,
    hasFrigateDrawingAction: boolean,
    hasEvolverDrawingAction: boolean,
    hasQuantumMysticDrawingAction: boolean
  ): ActionPanelId | null {
    const renderableChoiceActions = getRenderableServerChoiceActions(
      phaseKey,
      availableActionsForPhase
    );
    const renderableActionShipPresence = getRenderableActionShipPresence(
      phaseKey,
      availableActionsForPhase
    );

    switch (phaseKey) {
      case 'build.dice_roll': {
        const hasCubeAction = renderableChoiceActions.some(
          (action) =>
            action.actionId === 'CUB#0' && action.shipDefId === 'CUB'
        );
        const hasKnowledgeAction = renderableChoiceActions.some(
          (action) =>
            action.actionId === 'KNO#0' && action.shipDefId === 'KNO'
        );

        if (hasCubeAction && hasKnowledgeAction) {
          console.error(
            '[useGameSession] build.dice_roll: CUB#0 and KNO#0 were projected together; failing closed'
          );
          return null;
        }

        if (hasCubeAction) {
          return 'ap.build.dice_roll.cube';
        }

        if (hasKnowledgeAction) {
          return 'ap.build.dice_roll.centaur';
        }

        return null;
      }
      
      case 'build.drawing':
        return getBuildDrawingActionPanelId(
          activeBuildDrawingFamily,
          hasFrigateDrawingAction,
          hasEvolverDrawingAction,
          hasQuantumMysticDrawingAction
        );
      
      case 'battle.first_strike':
        return activeFirstStrikeFamily == null
          ? null
          : getFirstStrikePanelIdForFamily(activeFirstStrikeFamily);
      
      case 'battle.charge_declaration':
        if (mySpecies === 'human') return 'ap.battle.charges.human';
        if (mySpecies === 'xenite') return 'ap.battle.charges.xenite';
        if (mySpecies === 'centaur') {
          if (
            renderableActionShipPresence.hasCentaurNonEquChargeAction ||
            renderableActionShipPresence.hasCentaurEquChargeAction
          ) {
            return 'ap.battle.charges.centaur';
          }

          return 'ap.battle.charges.centaur';
        }
        if (mySpecies === 'ancient') {
          return 'ap.battle.charges.ancient';
        }
        return null;
      
      default:
        return null;
    }
  }
  
  // Helper: Check if a panel ID is a catalogue panel
  
  // Helper: Get species display label (Title Case)
  function getSpeciesLabel(species: SpeciesId): string {
    switch (species) {
      case 'human': return 'Human';
      case 'xenite': return 'Xenite';
      case 'centaur': return 'Centaur';
      case 'ancient': return 'Ancient';
    }
  }

  function getCatalogueSpeciesFromPanelId(panelId: ActionPanelId): SpeciesId | null {
    switch (panelId) {
      case 'ap.catalog.ships.human':
        return 'human';
      case 'ap.catalog.ships.xenite':
        return 'xenite';
      case 'ap.catalog.ships.centaur':
        return 'centaur';
      case 'ap.catalog.ships.ancient':
        return 'ancient';
      default:
        return null;
    }
  }

  function isFirstStrikeActionPanelId(panelId: ActionPanelId): boolean {
    return (
      panelId === 'ap.battle.first_strike.human' ||
      panelId === 'ap.battle.first_strike.centaur' ||
      panelId === 'ap.battle.first_strike.xenite' ||
      panelId === 'ap.battle.first_strike.ancient'
    );
  }

  function getBuildDrawingActionPanelId(
    activeFamily: BuildDrawingActionFamily | null,
    hasFrigateAction: boolean,
    hasEvolverAction: boolean,
    hasQuantumMysticAction: boolean
  ): ActionPanelId | null {
    if (activeFamily === 'frigate' && hasFrigateAction) {
      return 'ap.build.drawing.human';
    }

    if (activeFamily === 'evolver' && hasEvolverAction) {
      return 'ap.build.drawing.xenite';
    }

    if (activeFamily === 'quantum_mystic' && hasQuantumMysticAction) {
      return 'ap.build.drawing.ancient';
    }

    if (hasEvolverAction) {
      return 'ap.build.drawing.xenite';
    }

    if (hasFrigateAction) {
      return 'ap.build.drawing.human';
    }

    if (hasQuantumMysticAction) {
      return 'ap.build.drawing.ancient';
    }

    return null;
  }

  // ============================================================================
  // ACTIONS TAB: COMPUTE AVAILABILITY (UI-ONLY)
  // ============================================================================

  const renderableActionShipPresence = getRenderableActionShipPresence(
    phaseKey,
    availableActions
  );

  const centaurChargeAvailableTabs: CentaurChargeSubTabId[] = [];
  if (renderableActionShipPresence.hasCentaurNonEquChargeAction) {
    centaurChargeAvailableTabs.push('charges');
  }
  if (renderableActionShipPresence.hasCentaurEquChargeAction) {
    centaurChargeAvailableTabs.push('ship_of_equality');
  }

  const defaultCentaurChargeSubTab: CentaurChargeSubTabId =
    centaurChargeAvailableTabs.includes('charges') ? 'charges' : 'ship_of_equality';

  useEffect(() => {
    const isCentaurChargePhase =
      mySpecies === 'centaur' &&
      phaseKey === 'battle.charge_declaration';

    if (!isCentaurChargePhase || centaurChargeAvailableTabs.length === 0) {
      return;
    }

    setCentaurChargeSubTabByPhaseInstanceKey((prev) => {
      const current = prev[phaseInstanceKey];
      if (current && centaurChargeAvailableTabs.includes(current)) {
        return prev;
      }

      return {
        ...prev,
        [phaseInstanceKey]: defaultCentaurChargeSubTab,
      };
    });
  }, [
    mySpecies,
    phaseKey,
    phaseInstanceKey,
    defaultCentaurChargeSubTab,
    centaurChargeAvailableTabs.join('|'),
  ]);

  const activeCentaurChargeSubTab =
    centaurChargeSubTabByPhaseInstanceKey[phaseInstanceKey] ?? defaultCentaurChargeSubTab;

  const activeBuildPreviewCountsRef = getActiveBuildPreviewCountsRefForTurn(turnNumber);
  const frigateDemandCount = Number.isInteger(activeBuildPreviewCountsRef?.FRI)
    ? Math.max(0, activeBuildPreviewCountsRef.FRI)
    : 0;
  const quantumMysticDemandCount = Number.isInteger(activeBuildPreviewCountsRef?.QUA)
    ? Math.max(0, activeBuildPreviewCountsRef.QUA)
    : 0;

  const hasFrigateDrawingAction =
    phaseKey === 'build.drawing' &&
    canEditCurrentDrawingBuild &&
    frigateDemandCount > 0;
  const hasEvolverDrawingAction =
    phaseKey === 'build.drawing' &&
    canEditCurrentDrawingBuild &&
    evolverRowIdsSet.size > 0;
  const hasQuantumMysticDrawingAction =
    phaseKey === 'build.drawing' &&
    canEditCurrentDrawingBuild &&
    quantumMysticDemandCount > 0;
  const buildDrawingAvailableFamilies: BuildDrawingActionFamily[] = [
    ...(hasEvolverDrawingAction ? ['evolver' as const] : []),
    ...(hasFrigateDrawingAction ? ['frigate' as const] : []),
    ...(hasQuantumMysticDrawingAction ? ['quantum_mystic' as const] : []),
  ];
  const buildDrawingAvailableFamiliesKey = buildDrawingAvailableFamilies.join('|');

  useEffect(() => {
    if (phaseKey !== 'build.drawing') {
      return;
    }

    setBuildDrawingFamilyByPhaseInstanceKey((prev) => {
      const currentFamily = prev[phaseInstanceKey];
      if (currentFamily && buildDrawingAvailableFamilies.includes(currentFamily)) {
        return prev;
      }

      const nextFamily = buildDrawingAvailableFamilies[0];
      if (!nextFamily) {
        if (!(phaseInstanceKey in prev)) {
          return prev;
        }

        const { [phaseInstanceKey]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [phaseInstanceKey]: nextFamily,
      };
    });
  }, [buildDrawingAvailableFamiliesKey, phaseInstanceKey, phaseKey]);

  const activeBuildDrawingFamily =
    phaseKey === 'build.drawing'
      ? buildDrawingFamilyByPhaseInstanceKey[phaseInstanceKey] ??
        buildDrawingAvailableFamilies[0] ??
        null
      : null;

  // Determine target panel ID for Actions tab (panel routing target when actions exist)
  const actionsTargetPanelId =
    drawingStage.kind === 'prelude' && carrierPreludeActionValidation.ok
      ? 'ap.build.drawing.prelude.carrier'
      : phaseToActionPanelId(
          phaseKey,
          mySpecies,
          availableActions,
          activeBuildDrawingFamily,
          routedFirstStrikeFamily,
          hasFrigateDrawingAction,
          hasEvolverDrawingAction,
          hasQuantumMysticDrawingAction
        );

  const selfCataloguePanelId = speciesToCataloguePanelId(mySpecies ?? 'human');
  const effectiveFirstStrikePanelId =
    routedFirstStrikeFamily == null
      ? null
      : getFirstStrikePanelIdForFamily(routedFirstStrikeFamily);
  const presentedActivePanelCandidate =
    isMixedFirstStrike && isFirstStrikeActionPanelId(activePanelId)
      ? effectiveFirstStrikePanelId ?? selfCataloguePanelId
      : activePanelId;
  const presentedActivePanelId = normalizeActionPanelId(
    presentedActivePanelCandidate,
    drawingStage.kind === 'prelude' && carrierPreludeActionValidation.ok
      ? 'ap.build.drawing.prelude.carrier'
      : selfCataloguePanelId,
  );

  // Client-only "special actions" that should make Actions tab visible even if server reports none.
  // This remains preview/runtime-only; legality is still server-authoritative.
  const hasClientActionsAvailable =
    (
      phaseKey === 'build.drawing' &&
      (hasFrigateDrawingAction || hasEvolverDrawingAction || hasQuantumMysticDrawingAction)
    ) || activeAncientChargeDeclarationWorkflow?.hadChargeStage === true;

  // Actions tab is visible if we have a target panel and either:
  // - server says actions exist, OR
  // - client has special actions (build preview driven panels)
  const hasActionsAvailable =
    !isFinished &&
    !isBootstrapping &&
    !!actionsTargetPanelId &&
    (hasServerActionsAvailable || hasClientActionsAvailable);

  const menuTargetPanelId: ActionPanelId = isFinished && !healthResolutionPresentationActive
    ? 'ap.end_of_game.result'
    : 'ap.menu.root';

  function isSpectatorSafePassivePanel(panelId: ActionPanelId): boolean {
    return (
      isCataloguePanel(panelId) ||
      panelId === 'ap.menu.root' ||
      panelId === 'ap.idle.blank' ||
      panelId === 'ap.end_of_game.result'
    );
  }

  function getSpectatorActionPanelFallback(): ActionPanelId {
    return p1Species ? speciesToCataloguePanelId(p1Species) : menuTargetPanelId;
  }

  const spectatorCatalogueTabs: ActionPanelTabVm[] = [];
  if (p1Species) {
    spectatorCatalogueTabs.push({
      tabId: 'tab.catalog.self',
      label: getSpeciesLabel(p1Species),
      visible: true,
      targetPanelId: speciesToCataloguePanelId(p1Species),
    });
  }
  if (p2Species && p2Species !== p1Species) {
    spectatorCatalogueTabs.push({
      tabId: 'tab.catalog.opponent',
      label: getSpeciesLabel(p2Species),
      visible: true,
      targetPanelId: speciesToCataloguePanelId(p2Species),
    });
  }
  
  // Build tabs based on phase
  let tabs: ActionPanelTabVm[];
  
  if (isViewerSpectator) {
    tabs = [
      ...spectatorCatalogueTabs,
      {
        tabId: 'tab.menu',
        label: 'Menu',
        visible: true,
        targetPanelId: menuTargetPanelId,
      },
    ];
  } else if (isInSpeciesSelection) {
    // RULE B: Species Selection phase
    // Show ONE species tab for ME (live updating from selectedSpecies) + Menu
    tabs = [
      {
        tabId: 'tab.catalog.selected',
        label: getSpeciesLabel(selectedSpecies), // Live updates when user clicks species cards
        visible: true,
        targetPanelId: speciesToCataloguePanelId(selectedSpecies),
      },
      {
        tabId: 'tab.menu',
        label: 'Menu',
        visible: true,
        targetPanelId: menuTargetPanelId,
      },
    ];
  } else {
    // RULE C: After species are locked in
    // Show species tabs based on MY species and OPPONENT species
    
    // Use my species and opponent species (not left/right)
    const effectiveMySpecies = mySpecies ?? 'human';
    const effectiveOpponentSpecies = opponentSpecies ?? 'human';
    
    // Determine if both players have same species
    const bothSameSpecies = mySpecies && opponentSpecies && mySpecies === opponentSpecies;
    
    // Show opponent tab only if:
    // 1. Opponent species is known (not null)
    // 2. Opponent species is different from mine
    const showOpponentTab = opponentSpecies !== null && !bothSameSpecies;
    
    tabs = [
      // Actions tab (conditional - first position when visible)
      {
        tabId: 'tab.actions',
        label: 'Actions',
        visible: hasActionsAvailable,
        targetPanelId: hasActionsAvailable && actionsTargetPanelId
          ? actionsTargetPanelId
          : speciesToCataloguePanelId(effectiveMySpecies),
      },
      // My species tab (always visible in post-selection)
      {
        tabId: 'tab.catalog.self',
        label: getSpeciesLabel(effectiveMySpecies),
        visible: true,
        targetPanelId: speciesToCataloguePanelId(effectiveMySpecies),
      },
      // Opponent species tab (only if different species and known)
      {
        tabId: 'tab.catalog.opponent',
        label: getSpeciesLabel(effectiveOpponentSpecies),
        visible: showOpponentTab,
        targetPanelId: speciesToCataloguePanelId(effectiveOpponentSpecies),
      },
      // Menu tab (always visible)
      {
        tabId: 'tab.menu',
        label: 'Menu',
        visible: true,
        targetPanelId: menuTargetPanelId,
      },
    ];
  }

  const spectatorCataloguePanelIds = isViewerSpectator
    ? tabs
        .filter((tab) => tab.visible && isCataloguePanel(tab.targetPanelId))
        .map((tab) => tab.targetPanelId)
    : [];
  const spectatorCataloguePanelIdKey = spectatorCataloguePanelIds.join('|');

  const activeCatalogueSpecies = getCatalogueSpeciesFromPanelId(activePanelId);
  const isCataloguePanelActive = activeCatalogueSpecies != null;
  const isLiveInGamePlayerCatalogue =
    !isFinished &&
    !isInSpeciesSelection &&
    myRole === 'player' &&
    isCataloguePanelActive;
  const isOwnedForeignCatalogueContext =
    isLiveInGamePlayerCatalogue &&
    activeCatalogueSpecies != null &&
    activeCatalogueSpecies !== mySpecies &&
    ownedForeignSpeciesSet.has(activeCatalogueSpecies);
  const isRelevantLiveCatalogueContext =
    isLiveInGamePlayerCatalogue &&
    (activeCatalogueSpecies === mySpecies || isOwnedForeignCatalogueContext);
  const isBuildableCatalogueContext =
    isRelevantLiveCatalogueContext &&
    phaseKey === 'build.drawing' &&
    canEditCurrentDrawingBuild &&
    buildEconomyForMe != null;
  const buildCatalogueContext =
    isBuildableCatalogueContext
      ? 'buildable'
      : isRelevantLiveCatalogueContext
        ? 'unavailable'
      : 'reference_only';

  const buildCatalogue = {
    context: buildCatalogueContext,
    canAddShipById: provisionalBuild.canAddShipById,
    displayCostByShipId: provisionalBuild.displayCostByShipId,
    eligibilityByShipId: provisionalBuild.eligibilityByShipId,
  } as const;
  
  // ============================================================================
  // CHUNK 5: READY BUTTON GATING
  // ============================================================================
  
  // Identify if I am a player
  const amPlayer = myRole === 'player';
  
  // Compute species selection completion for ME
  const mySpeciesSelectionComplete = 
    !!speciesCommitDoneByPhase[phaseInstanceKey] &&
    !!speciesRevealDoneByPhase[phaseInstanceKey];
  
  // Ready gating logic
  const hasIncompleteTargetedAction =
    Array.isArray(availableActions) &&
    getRenderableServerChoiceActions(phaseKey, availableActions).some((action) =>
      isRenderableTargetedAction(action) &&
      destroyTargetSatisfiedBySourceInstanceId[action.sourceInstanceId] !== true
    );
  const hasUnmappedFirstStrikeAction =
    phaseKey === 'battle.first_strike' &&
    firstStrikeClassification.unmappedActions.length > 0;
  const isNonInputBattleTransitionPhase =
    phaseKey === 'battle.reveal' || phaseKey === 'battle.end_of_turn_resolution';
  const ancientDeclarationLocalStateInvalid =
    activeAncientChargeDeclarationWorkflow != null &&
    (
      !ancientManualSolarCastReplay.valid ||
      activeAncientChargeDeclarationWorkflow.rejectionRecoveryPending
    );
  const hasIncompleteAncientBlackHoleSelection =
    activeAncientChargeDeclarationWorkflow?.selectorMode === 'blackHole' &&
    ancientBlackHoleTargeting.requiredTargetCount > 0 &&
    activeAncientChargeDeclarationWorkflow.blackHoleSelectedTargetInstanceIds.length !==
      ancientBlackHoleTargeting.requiredTargetCount;
  const hasIncompleteAncientSimulacrumSelection =
    activeAncientChargeDeclarationWorkflow?.selectorMode === 'simulacrum';

  let readyEnabled = true;
  let readyDisabledReason: string | null = null;
  
  // CHUNK 8: Game finished overrides everything
  if (isFinished) {
    readyEnabled = false;
    readyDisabledReason = 'Game over.';
  } else if (healthResolutionPresentationActive) {
    readyEnabled = false;
    readyDisabledReason = null;
  } else if (resumeSyncLocked) {
    readyEnabled = false;
    readyDisabledReason = 'Syncing authoritative state...';
  } else if (phaseKey === 'build.drawing' && drawingStage.kind === 'blocked') {
    readyEnabled = false;
    readyDisabledReason = 'Syncing authoritative state...';
  } else if (phaseKey === 'build.drawing' && drawingStage.kind === 'submitted') {
    readyEnabled = false;
    readyDisabledReason = null;
  } else if (
    phaseKey === 'build.drawing' &&
    drawingSubmissionInputLocked &&
    !hasAuthoritativeDrawingCommitment
  ) {
    readyEnabled = false;
    readyDisabledReason = 'Syncing authoritative state...';
  } else if (
    phaseKey === 'build.drawing' &&
    drawingStage.kind === 'prelude' &&
    !carrierPreludeActionValidation.ok
  ) {
    readyEnabled = false;
    readyDisabledReason = 'Loading actions…';
  } else if (
    phaseKey === 'build.drawing' &&
    drawingStage.kind === 'normal' &&
    !drawingBuildSubmitEligible
  ) {
    readyEnabled = false;
    readyDisabledReason = 'Syncing authoritative state...';
  } else if (
    phaseKey === 'build.drawing' &&
    drawingParticipation !== 'participant'
  ) {
    readyEnabled = false;
    readyDisabledReason = 'Spectators cannot ready up.';
  } else if (!amPlayer) {
    readyEnabled = false;
    readyDisabledReason = 'Spectators cannot ready up.';
  } else if (isInSpeciesSelection && !mySpeciesSelectionComplete) {
    readyEnabled = false;
    readyDisabledReason = 'Select and confirm your species first.';
  } else if (isNonInputBattleTransitionPhase) {
    readyEnabled = false;
    readyDisabledReason = null;
  } else if (hasIncompleteAncientBlackHoleSelection) {
    readyEnabled = false;
    readyDisabledReason = 'Must complete actions';
  } else if (hasIncompleteAncientSimulacrumSelection) {
    readyEnabled = false;
    readyDisabledReason = 'Must complete actions';
  } else if (ancientDeclarationLocalStateInvalid) {
    readyEnabled = false;
    readyDisabledReason = activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending
      ? 'Refreshing authoritative declaration state…'
      : 'Invalid local Solar cast sequence';
  } else {
    // Gate Ready in server-choice phases until availableActions arrives
    const isServerChoicePhase = 
      phaseKey === 'build.dice_roll' ||
      phaseKey === 'battle.first_strike' ||
      phaseKey === 'battle.charge_declaration';
    
    if (isServerChoicePhase && availableActions == null) {
      readyEnabled = false;
      readyDisabledReason = 'Loading actions…';
    } else if (
      hasUnmappedFirstStrikeAction ||
      firstStrikeHandoffTransitionPending ||
      effectiveMandatoryFirstStrikeFamilyIsUnresolved ||
      hasIncompleteTargetedAction
    ) {
      readyEnabled = false;
      readyDisabledReason = 'Must complete actions';
    } else {
      readyEnabled = true;
      readyDisabledReason = null;
    }
  }
  
  // ============================================================================
  // VIEW-MODEL CONSTRUCTION
  // ============================================================================
  
  // ============================================================================
  // CHUNK 10: PLAYER STATUS DERIVATION (READINESS + STATUS TEXT/TONE)
  // ============================================================================
  
  // Helper: Check if a player is ready for the current phase
  function isPlayerReady(playerId: string | null | undefined): boolean {
    return isPlayerReadyForPhase(rawState, playerId);
  }
  
  // Compute joined state
  const p1HasJoined = displayLeftHasJoined;
  const p2HasJoined = displayRightHasJoined;
  
  // Compute readiness
  const p1IsReady = p1HasJoined ? isPlayerReady(displayLeftReadyKey) : false;
  const p2IsReady = p2HasJoined ? isPlayerReady(displayRightReadyKey) : false;
  
  // DEV: Diagnostic log for identity key alignment (only when values change)
  const prevReadyKeysRef = useRef<string>('');
  useEffect(() => {
    const current = JSON.stringify({
      meId: me?.id,
      mePlayerId: me?.playerId,
      meReadyKey,
      opponentId: opponent?.id,
      opponentPlayerId: opponent?.playerId,
      opponentReadyKey,
    });
    
    if (current !== prevReadyKeysRef.current) {
      prevReadyKeysRef.current = current;
      console.log('[useGameSession] Identity key alignment:', {
        me: { id: me?.id, playerId: me?.playerId, readyKey: meReadyKey },
        opponent: { id: opponent?.id, playerId: opponent?.playerId, readyKey: opponentReadyKey },
      });
    }
  }, [me?.id, me?.playerId, meReadyKey, opponent?.id, opponent?.playerId, opponentReadyKey]);
  
  // Get current subphase label for status indicators
  const currentSubphaseLabel =
    isBootstrapping ? 'Loading…' : getSubphaseLabelFromPhaseKey(phaseKey);
  
  // Compute status text: undefined if not joined, "Ready" if ready, subphase label otherwise
  const p1StatusText =
    !p1HasJoined ? undefined : (p1IsReady ? 'Ready' : currentSubphaseLabel);
  
  const p2StatusText =
    !p2HasJoined ? undefined : (p2IsReady ? 'Ready' : currentSubphaseLabel);
  
  // Compute status tone: hidden if no text, 'ready' if "Ready", 'neutral' otherwise
  const p1StatusTone: HudStatusTone =
    !p1StatusText ? 'hidden' : (p1StatusText === 'Ready' ? 'ready' : 'neutral');
  
  const p2StatusTone: HudStatusTone =
    !p2StatusText ? 'hidden' : (p2StatusText === 'Ready' ? 'ready' : 'neutral');
  
  // ============================================================================
  // CLOCK DATA EXTRACTION
  // ============================================================================
  
  // Extract clock data from server state (only when rawState changes)
  // Store in ref for interpolation - this anchors to server poll updates
  useEffect(() => {
    if (!rawState) return;
    const clockData = getClockData(rawState);
    lastClockRef.current = clockData;
  }, [rawState]);
  
  // Determine if clocks should tick (display-only animation driver)
  const shouldTick =
    !isFinished &&
    lastClockRef.current &&
    lastClockRef.current.clocksAreLive &&
    ((p1HasJoined && !p1IsReady) || (p2HasJoined && !p2IsReady));
  
  // Tick driver effect (forces rerenders for smooth clock animation)
  // Use 250ms interval for smoother visual updates (still displays as MM:SS)
  useEffect(() => {
    if (!shouldTick) return;
    const id = window.setInterval(() => setClockTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [shouldTick]);
  

  // Detect build.drawing routing requests from live state and previous snapshots.
  // This effect is the sole owner of the previous-demand refs, and it latches
  // a durable one-shot route request before advancing those refs.
  useEffect(() => {
    const wasBuildDrawing = prevPhaseKeyRef.current === 'build.drawing';
    const isBuildDrawing = phaseKey === 'build.drawing';
    const previousFrigateDemandCount = prevFrigateDemandCountRef.current;
    const previousQuantumMysticDemandCount = prevQuantumMysticDemandCountRef.current;
    const previousEvolverRowIds = prevEvolverRowIdsRef.current;

    let nextRouteRequest: BuildDrawingRouteRequest = null;

    if (isBuildDrawing) {
      if (!wasBuildDrawing && hasEvolverDrawingAction) {
        nextRouteRequest = 'evolver-entry';
      } else if (
        wasBuildDrawing &&
        frigateDemandCount > previousFrigateDemandCount
      ) {
        nextRouteRequest = 'frigate-demand';
      } else if (
        wasBuildDrawing &&
        quantumMysticDemandCount > previousQuantumMysticDemandCount
      ) {
        nextRouteRequest = 'quantum-mystic-demand';
      } else if (
        wasBuildDrawing &&
        Array.from(evolverRowIdsSet).some((rowId) => !previousEvolverRowIds.has(rowId))
      ) {
        nextRouteRequest = 'evolver-added';
      }
    }

    if (nextRouteRequest !== null) {
      if (nextRouteRequest === 'frigate-demand') {
        setBuildDrawingFamilyByPhaseInstanceKey((prev) => ({
          ...prev,
          [phaseInstanceKey]: 'frigate',
        }));
      } else if (nextRouteRequest === 'quantum-mystic-demand') {
        setBuildDrawingFamilyByPhaseInstanceKey((prev) => ({
          ...prev,
          [phaseInstanceKey]: 'quantum_mystic',
        }));
      } else {
        setBuildDrawingFamilyByPhaseInstanceKey((prev) => ({
          ...prev,
          [phaseInstanceKey]: 'evolver',
        }));
      }
      setBuildDrawingRouteRequest(nextRouteRequest);
    }

    prevPhaseKeyRef.current = phaseKey;
    prevFrigateDemandCountRef.current = isBuildDrawing ? frigateDemandCount : 0;
    prevQuantumMysticDemandCountRef.current = isBuildDrawing ? quantumMysticDemandCount : 0;
    prevEvolverRowIdsRef.current = isBuildDrawing
      ? new Set(evolverRowIdsSet)
      : new Set();
  }, [evolverRowIdsKey, frigateDemandCount, hasEvolverDrawingAction, phaseInstanceKey, phaseKey, quantumMysticDemandCount]);

  useEffect(() => {
    if (phaseKey !== 'build.drawing') {
      return;
    }

    if (
      activePanelId !== 'ap.build.drawing.human' &&
      activePanelId !== 'ap.build.drawing.xenite' &&
      activePanelId !== 'ap.build.drawing.ancient'
    ) {
      return;
    }

    const nextPanelId = getBuildDrawingActionPanelId(
      activeBuildDrawingFamily,
      hasFrigateDrawingAction,
      hasEvolverDrawingAction,
      hasQuantumMysticDrawingAction
    );

    if (!nextPanelId) {
      setActivePanelId(selfCataloguePanelId);
      return;
    }

    if (nextPanelId !== activePanelId) {
      setActivePanelId(nextPanelId);
    }
  }, [
    activeBuildDrawingFamily,
    activePanelId,
    hasEvolverDrawingAction,
    hasFrigateDrawingAction,
    hasQuantumMysticDrawingAction,
    phaseKey,
    selfCataloguePanelId,
  ]);

  useEffect(() => {
    if (phaseKey !== 'battle.first_strike') {
      return;
    }

    if (!isFirstStrikeActionPanelId(activePanelId)) {
      return;
    }

    const nextPanelId = effectiveFirstStrikePanelId ?? selfCataloguePanelId;

    if (nextPanelId !== activePanelId) {
      setActivePanelId(nextPanelId);
    }
  }, [
    activePanelId,
    effectiveFirstStrikePanelId,
    phaseKey,
    selfCataloguePanelId,
  ]);

  useLayoutEffect(() => {
    if (!effectiveGameId || !isFinished) return;
    if (finishedRedirectHandledGameIdRef.current === effectiveGameId) return;

    finishedRedirectHandledGameIdRef.current = effectiveGameId;
    setActivePanelId('ap.end_of_game.result');
  }, [effectiveGameId, isFinished]);

  useEffect(() => {
    if (!phaseKey || isFinished) {
      deferredHandoffAutoOpenEntryKeyRef.current = null;
      lastDeferredHandoffEntryKeyRef.current = null;
      return;
    }

    if (lastDeferredHandoffEntryKeyRef.current === deferredHandoffPhaseEntryKey) {
      return;
    }

    lastDeferredHandoffEntryKeyRef.current = deferredHandoffPhaseEntryKey;

    if (isDeferredAutoPanelHandoffPhase(phaseKey) && !hasActionsAvailable) {
      deferredHandoffAutoOpenEntryKeyRef.current = deferredHandoffPhaseEntryKey;
      return;
    }

    deferredHandoffAutoOpenEntryKeyRef.current = null;
  }, [deferredHandoffPhaseEntryKey, hasActionsAvailable, isFinished, phaseKey]);

  // ============================================================================
  // ACTION PANEL ROUTING (PHASE-DRIVEN ONLY)
  // ============================================================================
  // Default to Actions on phase entry if actions are available.
  // Respect user panel clicks within the same phase.
  // ============================================================================

  useEffect(() => {
    if (!phaseKey) return;
    if (isFinished) return;

    const decision = decideAutoPanelRouting({
      phaseKey,
      hasActionsAvailable,
      actionsTargetPanelId,
      activePanelId,
      mySpecies,
      selectedSpecies,
      buildDrawingRouteRequest,
      drawingStage,
      carrierPreludeActionsValid: carrierPreludeActionValidation.ok,
    });

    if (decision.kind === 'setActivePanelId' && decision.nextPanelId !== activePanelId) {
      console.log(decision.log);
      setActivePanelId(decision.nextPanelId);
    }

    if (buildDrawingRouteRequest !== null) {
      setBuildDrawingRouteRequest(null);
    }

    // IMPORTANT:
    // This effect intentionally depends only on phase/selection entry signals,
    // finish state, and the durable build.drawing request token.
    // We do not depend on activePanelId or hasActionsAvailable,
    // otherwise polling would re-trigger routing.
  }, [
    phaseInstanceKey,
    selectedSpecies,
    buildDrawingRouteRequest,
    carrierPreludeActionValidation.ok,
    isFinished,
  ]);

  useEffect(() => {
    if (!phaseKey || isFinished) return;
    if (deferredHandoffAutoOpenEntryKeyRef.current !== deferredHandoffPhaseEntryKey) return;
    if (!isDeferredAutoPanelHandoffPhase(phaseKey)) {
      deferredHandoffAutoOpenEntryKeyRef.current = null;
      return;
    }
    if (!hasActionsAvailable) return;

    deferredHandoffAutoOpenEntryKeyRef.current = null;

    if (activePanelId === 'ap.menu.root') {
      return;
    }

    const decision = decideAutoPanelRouting({
      phaseKey,
      hasActionsAvailable,
      actionsTargetPanelId,
      activePanelId,
      mySpecies,
      selectedSpecies: null,
      buildDrawingRouteRequest: null,
    });

    if (decision.kind === 'setActivePanelId' && decision.nextPanelId !== activePanelId) {
      console.log(`[useGameSession] Deferred handoff: ${decision.log}`);
      setActivePanelId(decision.nextPanelId);
    }
  }, [
    activePanelId,
    actionsTargetPanelId,
    deferredHandoffPhaseEntryKey,
    hasActionsAvailable,
    isFinished,
    mySpecies,
    phaseKey,
  ]);

  useEffect(() => {
    if (!isViewerSpectator) {
      return;
    }

    if (isSpectatorSafePassivePanel(activePanelId)) {
      if (
        isCataloguePanel(activePanelId) &&
        !spectatorCataloguePanelIds.includes(activePanelId)
      ) {
        const nextPanelId = getSpectatorActionPanelFallback();
        if (nextPanelId !== activePanelId) {
          setActivePanelId(nextPanelId);
        }
      }
      return;
    }

    const nextPanelId = getSpectatorActionPanelFallback();
    if (nextPanelId !== activePanelId) {
      setActivePanelId(nextPanelId);
    }
  }, [
    activePanelId,
    isViewerSpectator,
    menuTargetPanelId,
    p1Species,
    spectatorCataloguePanelIdKey,
  ]);

  
  // Display-only interpolation helper
  // Snaps to server on every poll, interpolates between polls
  function getDisplayMs(playerId?: string, isReady?: boolean): number | undefined {
    const snap = lastClockRef.current;
    if (!snap || !playerId) return undefined;

    const base = snap.remainingMsByPlayerId[playerId];
    if (base == null) return undefined;

    // Game over: freeze display at last server snapshot (no interpolation)
    if (isFinished) return base;

    if (!snap.clocksAreLive) return base;
    if (isReady) return base;

    const elapsed = Math.max(0, Date.now() - snap.serverNowMs);
    return Math.max(0, base - elapsed);
  }
  
  // Get interpolated display values for both players
  const p1DisplayMs = getDisplayMs(displayLeftPlayer?.id, p1IsReady);
  const p2DisplayMs = getDisplayMs(displayRightPlayer?.id, p2IsReady);
  
  // Format clock times (show "--:--" when undefined, never fake "00:00")
  const p1ClockFormatted = p1DisplayMs == null ? '--:--' : formatClockMs(p1DisplayMs);
  const p2ClockFormatted = p2DisplayMs == null ? '--:--' : formatClockMs(p2DisplayMs);
  
  const vm: GameSessionViewModel = mapGameSessionVm({
    isBootstrapping,
    viewer: {
      viewerMode,
      isSpectator: isViewerSpectator,
      isPlayerViewer: isViewerPlayer,
      p1Name: p1?.name ?? 'Player 1',
      p2Name: p2?.name ?? 'Player 2',
    },

    me,
    opponent,
    displayLeftPlayer,
    displayRightPlayer,
    displayLeftSpeciesLabel,
    displayRightSpeciesLabel,
    displayLeftSpeciesId: displayLeftSpecies,
    displayRightSpeciesId: displayRightSpecies,

    p1HasJoined,
    p2HasJoined,

    p1IsReady,
    p2IsReady,
    
    p1ClockFormatted,
    p2ClockFormatted,

    p1StatusText,
    p2StatusText,

    p1StatusTone,
    p2StatusTone,

    turnNumber,
    phaseKey,
    phaseIcon,
    turnPhaseProgress,

    effectiveGameId,
    allPlayers,

    activePanelId: presentedActivePanelId,
    tabs,
    buildCatalogue,
    drawingStage,

    board,
    healthResolutionLockActive,
    healthResolutionPresentationActive,
    healthResolutionOverlay,
    myFleetHealthDeltaFlash,
    opponentFleetHealthDeltaFlash,
    healthDeltaPresentationKey,

    readyEnabled,
    readyDisabledReason,
    resumeSyncLocked,

    battleLogHistory,

    getMajorPhaseLabel,
    getSubphaseLabelFromPhaseKey,
    
    chatEntries,
    controllersByPlayerId: rawState?.controllersByPlayerId,

    // New params for menu/end-of-game panels
    isFinished,
    winnerPlayerId: terminalWinnerPlayerId,
    resultReason: terminalResultReason,
    
    // Ready UX state (SENDING/WAITING labels)
    readyUx: readyUxForCurrentPhase,

    // Server availableActions for charge panels
    availableActions: Array.isArray(availableActions) ? availableActions : null,

    // Selection state for ship choice panels
    selectedChoiceIdBySourceInstanceId: shipChoiceSelectionByInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    allocatedDestroyTargetIdBySourceInstanceId,
    destroyTargetSatisfiedBySourceInstanceId,
    
    // Raw gameData for server truth
    gameData: rawState?.gameData,
    shipsByPlayerId: getShipsByPlayerId(rawState),
    chronoswarmRolls,
    cubeDiceValueByPlayerId,
    cubeDiceUsedByPlayerId,
    
    // Left rail dice presentation (client-delayed during health lock)
    leftRailDiceValue: presentedLeftRailDiceValue,
    leftRailDiceAnimateKey: presentedLeftRailDiceAnimateSeq,
    leftRailChronoswarmAnimateKey: presentedChronoswarmAnimateSeq,
    leftRailCubeAnimateKey: presentedCubeAnimateSeq,

    // Client-only: build preview + Frigate triggers for build.drawing special panels
    buildPreviewCounts: activeBuildPreviewCountsRef,
    frigateSelectedTriggers: frigateSelectedTriggersRef.current,
    quantumMysticSelectedNumbers: quantumMysticSelectedNumbersRef.current,
    evolverRowIds,
    evolverChoicesByRowId,
    buildDrawingFamilySwitch:
      phaseKey === 'build.drawing' &&
      buildDrawingAvailableFamilies.length > 1 &&
      activeBuildDrawingFamily != null
        ? {
            activeFamily: activeBuildDrawingFamily,
            availableFamilies: buildDrawingAvailableFamilies,
          }
        : undefined,
    centaurChargeSubTab: activeCentaurChargeSubTab,
    centaurChargeAvailableTabs,
    buildDrawingEconomyDisplay,
    committedDrawingProjection,
    ancientChargeDeclaration: activeAncientChargeDeclarationWorkflow
      ? {
          stage: activeAncientChargeDeclarationWorkflow.stage,
          hadChargeStage: activeAncientChargeDeclarationWorkflow.hadChargeStage,
          entryDisposition: activeAncientChargeDeclarationWorkflow.entryDisposition,
          manualOnlyPauseRequired: ancientAutocastEntryDecision.requiresManualPause,
          chargesDirectSubmissionEligible: ancientChargesDirectSubmissionEligible,
          provisionalEnergy: provisionalAncientEnergy,
          provisionalEnergyCapacity: authoritativeAncientEnergy,
          localManualSolarCasts: activeAncientChargeDeclarationWorkflow.localManualSolarCasts,
          canCastManualSolarPowerById: canCastAncientManualSolarPowerById,
          solarHoverValuesById: ancientSolarHoverValuesById,
          selectorMode: activeAncientChargeDeclarationWorkflow.selectorMode,
          siphonSelector: ancientSiphonSelector,
          simulacrumSelector: {
            ...ancientSimulacrumSelector,
            hoveredPreviewBlueCost: ancientSimulacrumHoveredPreviewBlueCost,
            hasLegalTargetBeforeAffordability:
              ancientSimulacrumTargeting.hasLegalTargetBeforeAffordability,
          },
          blackHoleSelector: {
            canOpen: canCastAncientBlackHole,
            requiredTargetCount: ancientBlackHoleTargeting.requiredTargetCount,
            selectedTargetCount:
              activeAncientChargeDeclarationWorkflow.blackHoleSelectedTargetInstanceIds.length,
            damagePreview: ancientBlackHoleDamagePreview,
          },
          autocastEnabled: ancientAutocastEnabled,
          attemptUnresolved: activeAncientChargeDeclarationAttempt != null,
          rejectionRecoveryPending:
            activeAncientChargeDeclarationWorkflow.rejectionRecoveryPending,
        }
      : undefined,
    ancientCatalogueEnergy,
    ancientAutocastEnabled,
  });
  const turnPhasePresentation = useTurnPhasePresentation({
    gameId: effectiveGameId,
    vm: vm.turnPhases,
    healthResolutionOverlay,
    presentedTurnReleaseKey,
    presentedTurnReleaseTurnNumber,
    isBootstrapping,
    isFinished,
  });
  
  // ============================================================================
  // ACTION CALLBACKS (NO-OPS)
  // ============================================================================
  
  function navigateToGameId(nextGameId: string): void {
    if (options.onNavigateToGame) {
      options.onNavigateToGame(nextGameId);
      return;
    }

    window.location.assign(buildShareGameUrl(nextGameId));
  }

  async function handleRematch(): Promise<void> {
    if (!effectiveGameId) {
      console.error('[useGameSession] New game blocked: missing effectiveGameId');
      return;
    }

    attemptMobileGameFullscreen();

    try {
      const response = await authenticatedPost(`/new-game-from/${effectiveGameId}`, {});

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useGameSession] New game request failed:', response.status, errorText);
        return;
      }

      const result = await response.json();
      const newGameId = typeof result?.gameId === 'string' ? result.gameId : null;

      if (!newGameId) {
        console.error('[useGameSession] New game request returned invalid payload:', result);
        return;
      }

      navigateToGameId(newGameId);
    } catch (err: any) {
      console.error('[useGameSession] New game request error:', err?.message ?? err);
    }
  }

  function handleJoinRematchInvite(gameIdToJoin: string): void {
    if (!gameIdToJoin) {
      return;
    }

    attemptMobileGameFullscreen();

    navigateToGameId(gameIdToJoin);
  }

  async function handleReadyToggle(
    submissionOrigin: 'manual' | 'auto-entry'
  ): Promise<void> {
      if (healthResolutionPresentationActive) {
        return;
      }

      if (
        activeAncientChargeDeclarationWorkflow?.stage === 'charges' &&
        phaseKey === 'battle.charge_declaration'
      ) {
        if (!readyEnabled || readyDisabledReason || activeAncientChargeDeclarationAttempt) {
          return;
        }
        if (!ancientChargesDirectSubmissionEligible) {
          setAncientChargeDeclarationWorkflow({
            ...activeAncientChargeDeclarationWorkflow,
            stage: 'powers',
            entryDisposition: 'manual',
          });
          setActivePanelId('ap.catalog.ships.ancient');
          return;
        }
        setAncientChargeDeclarationWorkflow({
          ...activeAncientChargeDeclarationWorkflow,
          entryDisposition: 'auto-submitting',
        });
      }

      const guardedDrawingPreludeKey =
        phaseKey === 'build.drawing' &&
        drawingStage.kind === 'prelude' &&
        carrierPreludeActionValidation.ok
          ? phaseInstanceKey
          : null;
      if (guardedDrawingPreludeKey) {
        if (drawingPreludeSubmissionGuardRef.current !== null) {
          return;
        }
        drawingPreludeSubmissionGuardRef.current = guardedDrawingPreludeKey;
      }

      if (
        phaseKey === 'build.drawing' &&
        drawingStage.kind === 'normal' &&
        buildDrawingEconomyDisplay != null
      ) {
        committedDrawingProjectionRef.current = {
          key: committedDrawingProjectionKey,
          ordinary: buildDrawingEconomyDisplay.projectedSavedOrdinary,
          joining: buildDrawingEconomyDisplay.projectedSavedJoining,
        };
      }

      // Snapshot build preview before async flow to prevent race conditions
      const buildPreviewSnapshot = { ...getActiveBuildPreviewCountsRefForTurn(turnNumber) };
      
      // Capture the phase key at click time (important: don't drift if phase advances mid-await)
      const clickedPhaseInstanceKey = phaseInstanceKey;
      let ancientAttemptForSubmission = activeAncientChargeDeclarationAttempt;
      if (
        (
          activeAncientChargeDeclarationWorkflow?.stage === 'powers' ||
          ancientChargesDirectSubmissionEligible
        ) &&
        phaseKey === 'battle.charge_declaration' &&
        myRole === 'player' &&
        !isFinished &&
        readyEnabled &&
        !readyDisabledReason &&
        ancientManualSolarCastReplay.valid &&
        !activeAncientChargeDeclarationWorkflow.rejectionRecoveryPending &&
        effectiveGameId != null &&
        !ancientAttemptForSubmission
      ) {
        const payload = buildAncientChargeDeclarationPayload({
          declarationId: generateNonce(),
          actions: ancientDeclarationActions,
          selectedChoiceIdBySourceInstanceId: shipChoiceSelectionByInstanceId,
          allocatedTargetIdsBySourceInstanceId: allocatedDestroyTargetIdsBySourceInstanceId,
          allocatedTargetIdBySourceInstanceId: allocatedDestroyTargetIdBySourceInstanceId,
          localManualSolarCasts: activeAncientChargeDeclarationWorkflow.localManualSolarCasts,
          autocastEnabled: ancientAutocastEnabled,
        });
        ancientAttemptForSubmission = {
          workflowKey: ancientChargeDeclarationWorkflowKey,
          presentationSolarCasts:
            snapshotAncientManualSolarCastsForPresentation(
              activeAncientChargeDeclarationWorkflow.localManualSolarCasts
            ),
          body: {
            gameId: effectiveGameId,
            intentType: 'CHARGE_DECLARATION_SUBMIT',
            turnNumber,
            payload,
          },
          eventsHandled: false,
        };
        setAncientChargeDeclarationAttempt(ancientAttemptForSubmission);
        setAncientBlackHoleHover(null);
        setAncientSimulacrumHover(null);
        setAncientChargeDeclarationWorkflow((current) =>
          current?.key === ancientChargeDeclarationWorkflowKey
            ? {
                ...current,
                selectorMode: null,
                blackHoleSelectedTargetInstanceIds: [],
              }
            : current
        );
      }
      
      // Only show "SENDING..." if this click is actually allowed to send
      const willAttemptSend =
        (phaseKey === 'build.drawing'
          ? drawingParticipation === 'participant'
          : myRole === 'player') &&
        !isFinished &&
        !healthResolutionPresentationActive &&
        !isNonInputBattleTransitionPhase &&
        readyEnabled &&
        !readyDisabledReason;
      
      if (willAttemptSend) {
        // Automatic entry is not an explicit Ready click, but still uses the same sending UX.
        setReadyUxByPhaseInstanceKey(prev => ({
          ...prev,
          [clickedPhaseInstanceKey]: {
            clickedThisPhase: submissionOrigin === 'manual',
            sendingNow: true,
          },
        }));
      }
      
      try {
        await runReadyToggleFlow({
          isFinished,
          readyEnabled,
          readyDisabledReason,
          resumeSyncLocked,

          phaseKey,
          myRole,
          mySessionId,
          drawingParticipation,
          normalizedDrawingPrelude,
          drawingStage,
          currentCarrierActions: carrierPreludeActionValidation.ok
            ? carrierPreludeActionValidation.actions
            : null,
          carrierChoiceIdBySourceInstanceId: {
            ...shipChoiceSelectionByInstanceId,
            ...explicitShipChoiceBySourceRef.current,
          },
          requesterPlayerId: meReadyKey ?? me?.id ?? null,

          effectiveGameId,
          turnNumber,

          buildInstanceKey: buildServerKey,
          buildPreviewCounts: buildPreviewSnapshot,
          frigateSelectedTriggers: frigateSelectedTriggersRef.current,
          quantumMysticSelectedNumbers: quantumMysticSelectedNumbersRef.current,
          evolverChoiceSourceRowIds,
          evolverChoicesByRowId: evolverChoicesByRowIdRef.current,

          setBuildSubmittedByTurn,

          buildCommitDoneByPhase,
          buildRevealDoneByPhase,
          setBuildCommitDoneByPhase,
          setBuildRevealDoneByPhase,

          buildCommitCache,

          rawState,
          me,
          setAwaitingBuildRevealSync,

          generateNonce,
          makeCommitHash,
          submitIntent,
          appendEvents: (events, meta) => appendEventsToTape(setEventTape, events, meta),
          onIntentResult: handleIntentResultForHealthPresentation,
          refreshGameStateOnce,
          maybeAutoRevealBuild,
          bumpDiceRollSeq: (n: number) => setDiceRollSeq(prev => prev + n),

          // Charge panel context (Prompt 9)
          availableActions: Array.isArray(availableActions) ? availableActions : null,
          getLatestAvailableActions,
          getLatestRawState: () => rawStateRef.current,
          selectedChoiceIdBySourceInstanceId: shipChoiceSelectionByInstanceId,
          allocatedDestroyTargetIdsBySourceInstanceId,
          allocatedDestroyTargetIdBySourceInstanceId,
          destroyTargetSatisfiedBySourceInstanceId,
          ancientChargeDeclarationAttempt: ancientAttemptForSubmission,
          onAncientDeclarationExplicitRejection: () => {
            ancientRejectionRecoveryBaselineStateRef.current = rawStateRef.current;
            setAncientChargeDeclarationAttempt(null);
            setAncientSimulacrumHover(null);
            setAncientChargeDeclarationWorkflow((current) =>
              current?.key === ancientChargeDeclarationWorkflowKey
                ? {
                    ...current,
                    localManualSolarCasts: [],
                    selectorMode: null,
                    blackHoleSelectedTargetInstanceIds: [],
                    entryDisposition: 'manual',
                    rejectionRecoveryPending: true,
                  }
                : current
            );
          },
          onAncientDeclarationEventsHandled: () => {
            setAncientChargeDeclarationAttempt((current) =>
              current?.workflowKey === ancientChargeDeclarationWorkflowKey
                ? { ...current, eventsHandled: true }
                : current
            );
          },
        });
      } finally {
        if (drawingPreludeSubmissionGuardRef.current === guardedDrawingPreludeKey) {
          drawingPreludeSubmissionGuardRef.current = null;
        }
        if (willAttemptSend) {
          // Clear SENDING... regardless of success/failure so the UI can't get stuck.
          setReadyUxByPhaseInstanceKey(prev => ({
            ...prev,
            [clickedPhaseInstanceKey]: {
              ...(prev[clickedPhaseInstanceKey] ?? {
                clickedThisPhase: submissionOrigin === 'manual',
                sendingNow: false,
              }),
              sendingNow: false,
            },
          }));
        }
      }
  }

  const actions: GameSessionActions = {
    onReadyToggle: () => {
      void handleReadyToggle('manual');
    },

    onUndoActions: () => {
      console.log('[useGameSession] Undo actions clicked (no-op)');
    },
    
    onOpenMenu: () => {
      console.log('[useGameSession] Open menu clicked');
      setActivePanelId(menuTargetPanelId);
    },
    
    onActionPanelTabClick: (tabId: ActionPanelTabId) => {
      console.log('[useGameSession] Action panel tab clicked:', tabId);

      if (
        tabId === 'tab.actions' &&
        phaseKey === 'battle.charge_declaration' &&
        activeAncientChargeDeclarationWorkflow?.key === ancientChargeDeclarationWorkflowKey &&
        activeAncientChargeDeclarationWorkflow.stage === 'powers' &&
        activeAncientChargeDeclarationWorkflow.hadChargeStage &&
        activeAncientChargeDeclarationAttempt == null &&
        !activeAncientChargeDeclarationWorkflow.rejectionRecoveryPending &&
        !ancientPlayerReady
      ) {
        setAncientBlackHoleHover(null);
        setAncientSimulacrumHover(null);
        setAncientChargeDeclarationWorkflow((current) =>
          current?.key === ancientChargeDeclarationWorkflowKey &&
          current.stage === 'powers' &&
          current.hadChargeStage &&
          !current.rejectionRecoveryPending
            ? {
                ...current,
                stage: 'charges',
                selectorMode: null,
                blackHoleSelectedTargetInstanceIds: [],
              }
            : current
        );
        setActivePanelId('ap.battle.charges.ancient');
        return;
      }
      
      // Find the tab and navigate to its target panel
      const tab = tabs.find(t => t.tabId === tabId);
      if (tab && tab.visible) {
        setActivePanelId(tab.targetPanelId);
      }
    },
    
    onShipClick: (shipId: string) => {
      console.log('[useGameSession] Ship clicked (no-op):', shipId);
    },
    
    onSendChat: async (text: string) => {
      // Trim text; if empty, return early
      const trimmedText = text.trim();
      
      if (!trimmedText) {
        console.log('[useGameSession] onSendChat: Empty message, ignoring');
        return;
      }
      
      try {
        console.log('[useGameSession] onSendChat: Sending message via ACTION intent');
        
        // Submit ACTION intent with message payload
        const response = await submitIntent({
          gameId: effectiveGameId,
          intentType: 'ACTION',
          turnNumber, // Current authoritative turn number
          payload: buildMessageAction(trimmedText),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useGameSession] onSendChat failed:', response.status, errorText);
          return;
        }
        
        const result = await response.json();
        
        if (!result.ok) {
          console.error('[useGameSession] onSendChat rejected:', result.rejected?.code, result.rejected?.message);
          return;
        }
        
        console.log('[useGameSession] onSendChat: Message sent successfully');
        await fetchChatOnce({
          gameIdToFetch: effectiveGameId,
          triggerBurstOnNewTail: false,
        });
        extendChatBurstWindow();
        scheduleNextChatPollRef.current?.(getNextChatPollDelayMs());
        
      } catch (err: any) {
        console.error('[useGameSession] onSendChat error:', err.message);
      }
    },
    
    onAcceptDraw: async () => {
      await submitMenuIntent('DRAW_ACCEPT');
    },
    
    onRefuseDraw: async () => {
      await submitMenuIntent('DRAW_REFUSE');
    },
    
    onOpenBattleLogFullscreen: () => {
      console.log('[useGameSession] Open battle log fullscreen (no-op)');
    },
    
    onSelectSpecies: (species: SpeciesId) => {
      if (speciesConfirmationGuardRef.current !== null || isSpeciesSelectionComplete) return;
      console.log('[useGameSession] Select species:', species);
      setSelectedSpecies(species);
      // Switch to the species' catalogue panel
      setActivePanelId(speciesToCataloguePanelId(species));
    },

    onSelectBotSpecies: (species: ComputerBotSpeciesId) => {
      if (speciesConfirmationGuardRef.current !== null || isSpeciesSelectionComplete) return;
      console.log('[useGameSession] Select computer species:', species);
      setSelectedBotSpecies(species);
    },

    onConfirmSpecies: async () => {
      if (speciesConfirmationGuardRef.current !== null || isSpeciesSelectionComplete) return;

      // PART E: Diagnostic logging before submission
      console.log('[useGameSession] onConfirmSpecies clicked:', {
        gameId: effectiveGameId,
        phaseKey,
        meRole: me?.role,
        meIsActive: me?.isActive,
        selectedSpecies,
        isComputerGame,
        selectedBotSpecies,
      });
      
      // PART D4: Strict client gating - button should be disabled but extra safety
      if (phaseKey !== 'setup.species_selection') {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: wrong phase', { phaseKey });
        return;
      }
      
      if (me?.role !== 'player') {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: not a player', { role: me?.role });
        return;
      }
      
      if (me?.isActive !== true) {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: not active', { isActive: me?.isActive });
        return;
      }
      
      if (!selectedSpecies) {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: no species selected');
        return;
      }

      const submittedSpecies = selectedSpecies;
      const submittedBotSpecies = isComputerGame ? selectedBotSpecies : null;
      const submissionEntryKey = speciesSelectionEntryKey;
      const requestId = speciesConfirmationRequestIdRef.current + 1;

      speciesConfirmationRequestIdRef.current = requestId;
      speciesConfirmationGuardRef.current = requestId;
      setPendingSpeciesConfirmation({
        requestId,
        entryKey: submissionEntryKey,
        submittedSpecies,
        submittedBotSpecies,
        isComputerGame,
      });

      try {
        const confirmed = await runSpeciesConfirmFlow({
          selectedSpecies: submittedSpecies,
          botSpecies: submittedBotSpecies ?? undefined,
          phaseKey,
          phaseInstanceKey,
          effectiveGameId,
          turnNumber,

          speciesCommitDoneByPhase,
          speciesRevealDoneByPhase,
          setSpeciesCommitDoneByPhase,
          setSpeciesRevealDoneByPhase,

          speciesCommitCache,

          generateNonce,
          makeCommitHash,
          submitIntent,
          appendEvents: (events, meta) => appendEventsToTape(setEventTape, events, meta),
          refreshGameStateOnce,
          mySessionId: mySessionId!,
          getLatestRawState: () => rawStateRef.current,
          bumpDiceRollSeq: (n: number) => setDiceRollSeq(prev => prev + n),
        });

        if (!confirmed) return;
      } finally {
        if (speciesConfirmationGuardRef.current === requestId) {
          speciesConfirmationGuardRef.current = null;
          setPendingSpeciesConfirmation((pending) =>
            pending?.requestId === requestId ? null : pending
          );
        }
      }
    },
    
    onCopyGameUrl: () => {
      // Copy the shareable game URL to clipboard
      // Use the active ?game=<id> route shape for direct game entry.
      if (!effectiveGameId) return;
      const shareGameUrl = buildShareGameUrl(effectiveGameId);
      
      navigator.clipboard.writeText(shareGameUrl)
        .then(() => {
          console.log('[useGameSession] Game URL copied to clipboard:', shareGameUrl);
        })
        .catch((err) => {
          console.error('[useGameSession] Failed to copy URL:', err);
        });
    },
    
    onBuildShip: (shipDefId: ShipDefId) => {
      // CHUNK 8: Hard stop if game finished (silent)
      if (isFinished) return;
      if (resumeSyncLocked) return;
      
      // ========================================================================
      // B) GATED LOCAL BUILD PREVIEW WITH AUTHORITATIVE TURN GATING
      // ========================================================================
      
      // Gate 1: Only in build.drawing phase
      if (phaseKey !== 'build.drawing') {
        return; // Silent no-op outside build.drawing
      }

      if (!canEditCurrentDrawingBuild) {
        return;
      }
      
      // Gate 2: Only for players (not spectators)
      if (myRole !== 'player') {
        return; // Silent no-op for spectators
      }
      
      // Gate 3: Use the UI-driving turnNumber for gating.
      // rawState can lag between polls and incorrectly block ship clicks.
      const uiTurnNumber = turnNumber;
      if (!Number.isFinite(uiTurnNumber)) {
        return;
      }
      
      const buildSubmitted = buildSubmittedByTurn[uiTurnNumber] === true;
      if (buildSubmitted) {
        return; // Silent no-op if build already submitted for this turn
      }
      
      const currentDraftCounts = getActiveBuildPreviewCountsRefForTurn(uiTurnNumber);
      const nextDraftCounts = addShipToBuildDraft(currentDraftCounts, shipDefId);
      const canAddShip = canProvisionallyAddShip({
        turnNumber: uiTurnNumber,
        myShips,
        draftCounts: nextDraftCounts,
        shipDefId,
        nativeSpecies: mySpecies,
        buildEconomy: buildEconomyForMe,
        frigateSelectedTriggers: frigateSelectedTriggersRef.current,
        quantumMysticSelectedNumbers: quantumMysticSelectedNumbersRef.current,
        evolverChoicesByRowId: evolverChoicesByRowIdRef.current,
        frigateTriggerByInstanceId,
      });

      if (!canAddShip) {
        return;
      }

      // All gates passed - update preview buffer
      console.log('[useGameSession] onBuildShip:', shipDefId, 'turn:', uiTurnNumber);

      buildPreviewCountsRef.current = nextDraftCounts;
      buildPreviewTurnNumberRef.current = uiTurnNumber;
      setBuildPreviewCounts(() => nextDraftCounts);
      setBuildPreviewTurnNumber(uiTurnNumber);

      // Existing rendered stacks keep immediate local stack-add feedback.
      // Brand-new rendered stacks stay on the normal diff-owned entry path.
      const targetRenderKey = getExistingRenderKeyForLocalBuild(shipDefId, myFleetWithPreview);
      if (targetRenderKey) {
        bumpMyStackAdd(targetRenderKey);
      }
    },
    
    onOfferDraw: async () => {
      await submitMenuIntent('DRAW_OFFER');
    },
    
    onResignGame: async () => {
      await submitMenuIntent('SURRENDER');
    },
    
    onRematch: handleRematch,

    onJoinRematchInvite: handleJoinRematchInvite,
    
    onDownloadBattleLog: () => {
      if (!effectiveGameId) {
        console.warn('[useGameSession] Download battle log blocked: missing gameId');
        return;
      }

      if (battleLogHistory == null) {
        console.warn('[useGameSession] Download battle log blocked: missing battleLogHistory');
        return;
      }

      downloadBattleLog({
        battleLogHistory,
        gameId: effectiveGameId,
        me: {
          identityKey: me?.playerId ?? me?.id ?? me?.sessionId ?? null,
          name: me?.name ?? null,
          species: mySpecies,
        },
        opponent: {
          identityKey: opponent?.playerId ?? opponent?.id ?? opponent?.sessionId ?? null,
          name: opponent?.name ?? null,
          species: opponentSpecies,
        },
        winnerPlayerId: terminalWinnerPlayerId,
        resultReason: terminalResultReason,
      });
    },
    
onSelectFrigateTrigger: (frigateIndex: number, triggerNumber: number) => {
  if (!canEditCurrentDrawingBuild) return;
  if (!Number.isInteger(triggerNumber) || triggerNumber < 1 || triggerNumber > 6) {
    return;
  }

  const currentSelections = frigateSelectedTriggersRef.current;
  if (frigateIndex < 0 || frigateIndex >= currentSelections.length) {
    return;
  }

  const currentPreviewFrigateRowIds = getDraftPreviewFrigateRowIds(turnNumber, currentSelections.length);
  const targetPreviewRowId = currentPreviewFrigateRowIds[frigateIndex];
  if (!targetPreviewRowId) {
    return;
  }

  const normalizedTriggerNumber = normalizeFrigateTriggerSelection(triggerNumber);
  const nextSelections = [...currentSelections];
  nextSelections[frigateIndex] = normalizedTriggerNumber;
  frigateSelectedTriggersRef.current = nextSelections;
  const nextPreviewTriggerByRowId = buildDraftPreviewFrigateTriggerByRowId(turnNumber, nextSelections);
  nextPreviewTriggerByRowId[targetPreviewRowId] = normalizedTriggerNumber;
  frigatePreviewTriggerByRowIdRef.current = nextPreviewTriggerByRowId;
  setFrigateSelectedTriggers(nextSelections);
  setActivePanelId(selfCataloguePanelId);
},

    onSelectQuantumMysticNumber: (quantumMysticIndex: number, selectedNumber: number) => {
      if (!canEditCurrentDrawingBuild) return;
      if (!Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > 6) {
        return;
      }

      const currentSelections = quantumMysticSelectedNumbersRef.current;
      if (quantumMysticIndex < 0 || quantumMysticIndex >= currentSelections.length) {
        return;
      }

      const currentPreviewRowIds = getDraftPreviewQuantumMysticRowIds(
        turnNumber,
        currentSelections.length
      );
      const targetPreviewRowId = currentPreviewRowIds[quantumMysticIndex];
      if (!targetPreviewRowId) {
        return;
      }

      const normalizedSelectedNumber = normalizeQuantumMysticSelection(selectedNumber);
      const nextSelections = [...currentSelections];
      nextSelections[quantumMysticIndex] = normalizedSelectedNumber;
      quantumMysticSelectedNumbersRef.current = nextSelections;
      const nextPreviewNumberByRowId = buildDraftPreviewQuantumMysticNumberByRowId(
        turnNumber,
        nextSelections
      );
      nextPreviewNumberByRowId[targetPreviewRowId] = normalizedSelectedNumber;
      quantumMysticPreviewNumberByRowIdRef.current = nextPreviewNumberByRowId;
      setQuantumMysticSelectedNumbers(nextSelections);
      setActivePanelId('ap.catalog.ships.ancient');
    },

    onSelectEvolverChoice: (rowId: string, choiceId: EvolverChoiceId) => {
      if (!canEditCurrentDrawingBuild) return;
      if (choiceId !== 'hold' && choiceId !== 'oxite' && choiceId !== 'asterite') {
        return;
      }

      if (!evolverRowIdsSet.has(rowId)) {
        return;
      }

      const nextChoicesByRowId = {
        ...evolverChoicesByRowIdRef.current,
        [rowId]: choiceId,
      };
      evolverChoicesByRowIdRef.current = nextChoicesByRowId;
      setEvolverChoicesByRowId(nextChoicesByRowId);
    },

    onSelectBuildDrawingFamily: (family: BuildDrawingActionFamily) => {
      if (!canEditCurrentDrawingBuild) {
        return;
      }
      if (!buildDrawingAvailableFamilies.includes(family)) {
        return;
      }

      setBuildDrawingFamilyByPhaseInstanceKey((prev) => ({
        ...prev,
        [phaseInstanceKey]: family,
      }));
      setActivePanelId(
        family === 'evolver'
          ? 'ap.build.drawing.xenite'
          : family === 'quantum_mystic'
            ? 'ap.build.drawing.ancient'
            : 'ap.build.drawing.human'
      );
    },

    onSelectShipChoiceForInstance: (sourceInstanceId: string, choiceId: string) => {
      if (
        activeAncientChargeDeclarationAttempt ||
        activeAncientChargeDeclarationWorkflow?.stage === 'powers' ||
        activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending
      ) {
        return;
      }
      if (phaseKey === 'build.drawing' && drawingStage.kind === 'prelude') {
        if (!carrierPreludeActionValidation.ok) return;
        const projectedAction = carrierPreludeActionValidation.actions.find(
          (action) => action.sourceInstanceId === sourceInstanceId,
        );
        if (!projectedAction?.choices.some((choice) => choice.choiceId === choiceId)) {
          return;
        }
        explicitShipChoiceBySourceRef.current = {
          ...explicitShipChoiceBySourceRef.current,
          [sourceInstanceId]: choiceId,
        };
      }
      setShipChoiceSelectionByInstanceId(prev => ({ ...prev, [sourceInstanceId]: choiceId }));
      applyDestroyTargetingChoiceSideEffects(sourceInstanceId, choiceId);
    },

    onCastAncientSolarPower: (solarPowerId: FixedAncientManualSolarPowerId) => {
      if (!isFixedAncientManualSolarPowerId(solarPowerId)) {
        return;
      }

      setAncientChargeDeclarationWorkflow((current) => {
        if (
          current?.key !== ancientChargeDeclarationWorkflowKey ||
          current.stage !== 'powers' ||
          current.rejectionRecoveryPending ||
          activeAncientChargeDeclarationAttempt
        ) {
          return current;
        }

        const replay = replayAncientManualSolarCasts({
          startingPool: authoritativeAncientEnergy,
          localManualSolarCasts: current.localManualSolarCasts,
        });
        const cost = ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID[solarPowerId];
        if (!replay.valid || !canAffordAncientEnergyCost(replay.remainingEnergy, cost)) {
          return current;
        }

        return {
          ...current,
          localManualSolarCasts: [...current.localManualSolarCasts, { solarPowerId }],
        };
      });
    },

    onOpenAncientSolarSelector: (mode: AncientSolarSelectorMode) => {
      setAncientBlackHoleHover(null);
      setAncientSimulacrumHover(null);
      setAncientChargeDeclarationWorkflow((current) => {
        if (
          current?.key !== ancientChargeDeclarationWorkflowKey ||
          current.stage !== 'powers' ||
          current.rejectionRecoveryPending ||
          activeAncientChargeDeclarationAttempt
        ) {
          return current;
        }

        const replay = replayAncientManualSolarCasts({
          startingPool: authoritativeAncientEnergy,
          localManualSolarCasts: current.localManualSolarCasts,
        });
        if (!replay.valid) {
          return current;
        }

        switch (mode) {
          case 'siphon':
            if (
              Math.min(replay.remainingEnergy.green, replay.remainingEnergy.red) <
                ANCIENT_SIPHON_MINIMUM_SPEND
            ) {
              return current;
            }
            return {
              ...current,
              selectorMode: 'siphon',
              blackHoleSelectedTargetInstanceIds: [],
            };
          case 'blackHole':
            if (
              !canAffordAncientEnergyCost(
                replay.remainingEnergy,
                ANCIENT_BLACK_HOLE_PREVIEW_COST
              )
            ) {
              return current;
            }
            if (ancientBlackHoleTargeting.requiredTargetCount === 0) {
              return {
                ...current,
                selectorMode: null,
                blackHoleSelectedTargetInstanceIds: [],
                localManualSolarCasts: [
                  ...current.localManualSolarCasts,
                  { solarPowerId: 'SBLA', targetInstanceIds: [] },
                ],
              };
            }
            return {
              ...current,
              selectorMode: 'blackHole',
              blackHoleSelectedTargetInstanceIds: [],
            };
          case 'simulacrum':
            if (
              !deriveAncientSimulacrumTargetingState({
                opponentShipsVisible,
                opponentFleet,
                myShips,
                localManualSolarCasts: current.localManualSolarCasts,
                remainingBlue: replay.remainingEnergy.blue,
              }).hasEligibleTarget
            ) {
              return current;
            }
            return {
              ...current,
              selectorMode: 'simulacrum',
              blackHoleSelectedTargetInstanceIds: [],
            };
        }
      });
    },

    onCancelAncientSolarSelector: () => {
      setAncientBlackHoleHover(null);
      setAncientSimulacrumHover(null);
      setAncientChargeDeclarationWorkflow((current) =>
        current?.key === ancientChargeDeclarationWorkflowKey && current.selectorMode != null
          ? {
              ...current,
              selectorMode: null,
              blackHoleSelectedTargetInstanceIds: [],
            }
          : current
      );
    },

    onCastAncientSiphon: (lockedAmount: number) => {
      if (!isValidAncientSiphonSpend(lockedAmount)) {
        return;
      }

      setAncientChargeDeclarationWorkflow((current) => {
        if (
          current?.key !== ancientChargeDeclarationWorkflowKey ||
          current.stage !== 'powers' ||
          current.selectorMode !== 'siphon' ||
          current.rejectionRecoveryPending ||
          activeAncientChargeDeclarationAttempt
        ) {
          return current;
        }

        const replay = replayAncientManualSolarCasts({
          startingPool: authoritativeAncientEnergy,
          localManualSolarCasts: current.localManualSolarCasts,
        });
        if (
          !replay.valid ||
          lockedAmount > replay.remainingEnergy.green ||
          lockedAmount > replay.remainingEnergy.red
        ) {
          return current;
        }

        const nextCasts: AncientManualSolarCast[] = [
          ...current.localManualSolarCasts,
          { solarPowerId: 'SSIP', lockedAmount },
        ];
        const nextReplay = replayAncientManualSolarCasts({
          startingPool: authoritativeAncientEnergy,
          localManualSolarCasts: nextCasts,
        });
        const canCastAgain =
          nextReplay.valid &&
          Math.min(
            nextReplay.remainingEnergy.green,
            nextReplay.remainingEnergy.red
          ) >= ANCIENT_SIPHON_MINIMUM_SPEND;

        return {
          ...current,
          selectorMode: canCastAgain ? 'siphon' : null,
          blackHoleSelectedTargetInstanceIds: [],
          localManualSolarCasts: nextCasts,
        };
      });
    },

    onSetAncientAutocastEnabled: (enabled: boolean) => {
      setAncientAutocastEnabled(enabled);
    },

    onSelectCentaurChargeSubTab: (tabId: CentaurChargeSubTabId) => {
      if (!centaurChargeAvailableTabs.includes(tabId)) {
        return;
      }

      setCentaurChargeSubTabByPhaseInstanceKey((prev) => ({
        ...prev,
        [phaseInstanceKey]: tabId,
      }));
    },

    onBoardBackgroundMouseDown: () => {
      if (ancientBlackHoleSelectorActive) {
        setAncientBlackHoleHover(null);
        return;
      }
      if (ancientSimulacrumSelectorActive) {
        setAncientSimulacrumHover(null);
        return;
      }
      if (
        activeAncientChargeDeclarationAttempt ||
        activeAncientChargeDeclarationWorkflow?.stage === 'powers' ||
        activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending
      ) {
        return;
      }
      handleDestroyTargetingBoardBackgroundMouseDown();
    },

    onDestroyTargetStackHoverChange: (side: 'my' | 'opponent', stackKey: string | null) => {
      if (ancientBlackHoleSelectorActive) {
        const isTargetable =
          side === 'opponent' &&
          stackKey != null &&
          ancientBlackHoleBoardTargeting.targetStatesBySide.opponent[stackKey]?.isTargetable === true;
        setAncientBlackHoleHover(
          isTargetable && stackKey
            ? { workflowKey: ancientChargeDeclarationWorkflowKey, stackKey }
            : null
        );
        return;
      }
      if (ancientSimulacrumSelectorActive) {
        const isTargetable =
          side === 'opponent' &&
          stackKey != null &&
          ancientSimulacrumBoardTargeting.targetStatesBySide.opponent[stackKey]
            ?.isTargetable === true;
        setAncientSimulacrumHover(
          isTargetable && stackKey
            ? { workflowKey: ancientChargeDeclarationWorkflowKey, stackKey }
            : null
        );
        return;
      }
      handleDestroyTargetStackHoverChange(side, stackKey);
    },

    onDestroyTargetStackMouseDown: (side: 'my' | 'opponent', stackKey: string) => {
      if (ancientBlackHoleSelectorActive) {
        if (side !== 'opponent') {
          return;
        }

        const nextTargetInstanceId = allocateNextAncientBlackHoleTarget({
          targeting: ancientBlackHoleTargeting,
          selectedTargetInstanceIds: ancientBlackHoleSelectedTargetInstanceIds,
          stackKey,
        });
        if (!nextTargetInstanceId) {
          return;
        }

        const willComplete =
          ancientBlackHoleSelectedTargetInstanceIds.length + 1 ===
          ancientBlackHoleTargeting.requiredTargetCount;
        setAncientChargeDeclarationWorkflow((current) => {
          if (
            current?.key !== ancientChargeDeclarationWorkflowKey ||
            current.selectorMode !== 'blackHole' ||
            current.stage !== 'powers'
          ) {
            return current;
          }

          const selectedTargetInstanceIds = current.blackHoleSelectedTargetInstanceIds;
          const allocatedTargetInstanceId = allocateNextAncientBlackHoleTarget({
            targeting: ancientBlackHoleTargeting,
            selectedTargetInstanceIds,
            stackKey,
          });
          if (!allocatedTargetInstanceId) {
            return current;
          }

          const nextTargetInstanceIds = [
            ...selectedTargetInstanceIds,
            allocatedTargetInstanceId,
          ];
          if (nextTargetInstanceIds.length !== ancientBlackHoleTargeting.requiredTargetCount) {
            return {
              ...current,
              blackHoleSelectedTargetInstanceIds: nextTargetInstanceIds,
            };
          }

          const orderedTargetInstanceIds = [...nextTargetInstanceIds]
            .sort((a, b) => a.localeCompare(b));
          const nextCasts: AncientManualSolarCast[] = [
            ...current.localManualSolarCasts,
            {
              solarPowerId: 'SBLA',
              targetInstanceIds: orderedTargetInstanceIds,
            },
          ];
          const nextReplay = replayAncientManualSolarCasts({
            startingPool: authoritativeAncientEnergy,
            localManualSolarCasts: nextCasts,
          });
          const nextReservedTargetInstanceIds = nextCasts.flatMap((cast) =>
            cast.solarPowerId === 'SBLA' ? cast.targetInstanceIds : []
          );
          const nextTargeting = deriveAncientBlackHoleTargetingState({
            opponentShipsVisible,
            opponentFleet,
            reservedTargetInstanceIds: nextReservedTargetInstanceIds,
          });
          const canCastAgain =
            nextReplay.valid &&
            canAffordAncientEnergyCost(
              nextReplay.remainingEnergy,
              ANCIENT_BLACK_HOLE_PREVIEW_COST
            ) &&
            nextTargeting.requiredTargetCount > 0;

          return {
            ...current,
            selectorMode: canCastAgain ? 'blackHole' : null,
            blackHoleSelectedTargetInstanceIds: [],
            localManualSolarCasts: nextCasts,
          };
        });
        if (willComplete) {
          setAncientBlackHoleHover(null);
        }
        return;
      }
      if (ancientSimulacrumSelectorActive) {
        if (side !== 'opponent') {
          return;
        }

        setAncientChargeDeclarationWorkflow((current) => {
          if (
            current?.key !== ancientChargeDeclarationWorkflowKey ||
            current.selectorMode !== 'simulacrum' ||
            current.stage !== 'powers' ||
            current.rejectionRecoveryPending ||
            activeAncientChargeDeclarationAttempt
          ) {
            return current;
          }

          const replay = replayAncientManualSolarCasts({
            startingPool: authoritativeAncientEnergy,
            localManualSolarCasts: current.localManualSolarCasts,
          });
          if (!replay.valid) {
            return current;
          }

          const targeting = deriveAncientSimulacrumTargetingState({
            opponentShipsVisible,
            opponentFleet,
            myShips,
            localManualSolarCasts: current.localManualSolarCasts,
            remainingBlue: replay.remainingEnergy.blue,
          });
          const target = allocateNextAncientSimulacrumTarget({
            targeting,
            stackKey,
          });
          if (!target) {
            return current;
          }

          return {
            ...current,
            blackHoleSelectedTargetInstanceIds: [],
            localManualSolarCasts: [
              ...current.localManualSolarCasts,
              {
                solarPowerId: 'SSIM',
                targetInstanceId: target.targetInstanceId,
                copiedShipDefId: target.copiedShipDefId,
                previewBlueCost: target.previewBlueCost,
                ...(target.previewCapturedStartOfBattleCharges !== undefined
                  ? {
                      previewCapturedStartOfBattleCharges:
                        target.previewCapturedStartOfBattleCharges,
                    }
                  : {}),
                previewPermanentConfiguration: {
                  ...target.previewPermanentConfiguration,
                },
              },
            ],
          };
        });
        setAncientSimulacrumHover(null);
        return;
      }
      if (
        activeAncientChargeDeclarationAttempt ||
        activeAncientChargeDeclarationWorkflow?.stage === 'powers' ||
        activeAncientChargeDeclarationWorkflow?.rejectionRecoveryPending
      ) {
        return;
      }
      handleDestroyTargetStackMouseDown(side, stackKey);
    },
  };

  useLayoutEffect(() => {
    const workflow = activeAncientChargeDeclarationWorkflow;
    if (
      !workflow ||
      workflow.hadChargeStage ||
      workflow.stage !== 'powers' ||
      workflow.entryDisposition !== 'unresolved' ||
      phaseKey !== 'battle.charge_declaration' ||
      !ancientDeclarationActionsLoaded ||
      ancientPlayerReady ||
      activeAncientChargeDeclarationAttempt != null ||
      workflow.rejectionRecoveryPending
    ) {
      return;
    }

    if (!ancientAutocastEnabled || ancientAutocastEntryDecision.requiresManualPause) {
      setAncientChargeDeclarationWorkflow((current) =>
        current?.key === ancientChargeDeclarationWorkflowKey &&
        current.entryDisposition === 'unresolved'
          ? { ...current, entryDisposition: 'manual' }
          : current
      );
      return;
    }

    if (
      rawState == null ||
      effectiveGameId == null ||
      mySessionId == null ||
      !readyEnabled ||
      readyDisabledReason != null ||
      !ancientManualSolarCastReplay.valid ||
      ancientAutoEntryGuardWorkflowKeyRef.current === ancientChargeDeclarationWorkflowKey
    ) {
      return;
    }

    ancientAutoEntryGuardWorkflowKeyRef.current = ancientChargeDeclarationWorkflowKey;
    setAncientChargeDeclarationWorkflow((current) =>
      current?.key === ancientChargeDeclarationWorkflowKey &&
      current.entryDisposition === 'unresolved'
        ? { ...current, entryDisposition: 'auto-submitting' }
        : current
    );
    void handleReadyToggle('auto-entry');
  }, [
    activeAncientChargeDeclarationAttempt,
    activeAncientChargeDeclarationWorkflow,
    ancientAutocastEnabled,
    ancientAutocastEntryDecision.requiresManualPause,
    ancientChargeDeclarationWorkflowKey,
    ancientDeclarationActionsLoaded,
    ancientManualSolarCastReplay.valid,
    ancientPlayerReady,
    effectiveGameId,
    mySessionId,
    phaseKey,
    rawState,
    readyDisabledReason,
    readyEnabled,
  ]);
  
  // ============================================================================
  // BOOTSTRAP RETURN (when no gameId provided)
  // ============================================================================
  
  const shouldBootstrap = !effectiveGameId;
  
  if (shouldBootstrap) {
    console.log('[useGameSession] No gameId provided - returning bootstrap VM');
    
    // Minimal safe VM that triggers "LOADING GAME" screen
    const bootstrapVm: GameSessionViewModel = {
      isBootstrapping: true,
      viewer: {
        viewerMode: 'unknown',
        isSpectator: false,
        isPlayerViewer: false,
        p1Name: 'Player 1',
        p2Name: 'Player 2',
      },
      gameStats: null,
      turnPhases: {
        turnNumber: null,
        currentMilestone: null,
        context: 'bootstrap',
        milestones: [
          { id: 'dice_roll', label: 'Dice Roll', isMandatory: true, isAvailable: false, hasOccurred: false },
          { id: 'drawing', label: 'Drawing', isMandatory: true, isAvailable: false, hasOccurred: false },
          { id: 'first_strike', label: 'First Strike', isMandatory: false, isAvailable: false, hasOccurred: false },
          { id: 'charges', label: 'Charges / Solar Powers', isMandatory: false, isAvailable: false, hasOccurred: false },
          { id: 'turn_resolution', label: 'Turn Resolution', isMandatory: true, isAvailable: false, hasOccurred: false },
        ],
      },
      turnPhasePresentation: {
        presentedMilestone: null,
        presentedTurnNumber: null,
        slabPositionIndex: null,
        wrapStage: 'idle',
        headingContext: 'bootstrap',
        movementDurationMs: 0,
        movementEasing: 'linear',
        reducedMotion: false,
      },
      hud: {
        p1Name: 'Player 1',
        p1Species: 'Unknown',
        p1IsOnline: false,
        p1Clock: '00:00',
        p1IsReady: false,
        p1StatusText: undefined,
        p1StatusTone: 'hidden',
        p2Name: 'Player 2',
        p2Species: 'Unknown',
        p2IsOnline: false,
        p2Clock: '00:00',
        p2IsReady: false,
        p2StatusText: undefined,
        p2StatusTone: 'hidden',
      },
      leftRail: {
        diceValue: 1,
        diceAnimateKey: 0,
        diceManipulationSlots: {
          left: null,
          right: null,
        },
        turn: 1,
        phase: 'UNKNOWN PHASE',
        phaseIcon: 'build',
        subphase: 'Unknown',
        gameCode: 'NOGAME',
        chatMessages: [],
        drawOffer: null,
        battleLogNames: {
          me: 'Player 1',
          opponent: 'Player 2',
        },
        battleLogTurns: [],
        battleLogCompletedTurnCount: 0,
        battleLogAutoScrollKey: 'battle:bootstrap:0',
      },
      board: {
        mode: 'board',
        mySpeciesId: 'human',
        opponentSpeciesId: 'human',
        turnNumber: 1,
        myHealth: 25,
        opponentHealth: 25,
        myMaxHealth: DEFAULT_MAX_HEALTH,
        opponentMaxHealth: DEFAULT_MAX_HEALTH,
        myBonusLines: 0,
        opponentBonusLines: 0,
        myBonusLinesOnEven: 0,
        opponentBonusLinesOnEven: 0,
        myDisplayedSavedLines: 0,
        opponentDisplayedSavedLines: 0,
        myDisplayedSavedJoiningLines: 0,
        opponentDisplayedSavedJoiningLines: 0,
        mySavedJoiningLines: 0,
        opponentSavedJoiningLines: 0,
        myJoiningBonusLines: 0,
        opponentJoiningBonusLines: 0,
        myFleet: [],
        opponentFleet: [],
        myVoidFleet: [],
        opponentVoidFleet: [],
        myAncientSolarEntries: [],
        opponentAncientSolarEntries: [],
        myFleetRenderOrder: [],
        opponentFleetRenderOrder: [],
        mobileDiceModifierSlots: {
          top: null,
          bottom: null,
        },
        myFleetHealthDeltaFlash: undefined,
        opponentFleetHealthDeltaFlash: undefined,
        fleetAnim: {
          my: {},
          opponent: {},
        },
        myLastTurnHeal: 0,
        myLastTurnDamage: 0,
        myLastTurnNet: 0,
        opponentLastTurnHeal: 0,
        opponentLastTurnDamage: 0,
        opponentLastTurnNet: 0,
        myLastDamageBreakdownRows: [],
        opponentLastDamageBreakdownRows: [],
        myLastHealingBreakdownRows: [],
        opponentLastHealingBreakdownRows: [],
        myBonusBreakdownRows: [],
        opponentBonusBreakdownRows: [],
        activationStaggerPlan: { myIndexByShipId: {}, opponentIndexByShipId: {} },
        presentedMyRevealBlurSeq: 0,
        presentedOpponentRevealBlurSeq: 0,
      },
      bottomActionRail: {
        subphaseTitle: '',
        subphaseTitleSuffix: null,
        mobileSubphaseTitleExtra: null,
        subphaseSubheading: '',
        canUndoActions: false,
        readyButtonVisible: true,
        readyButtonLabel: 'READY',
        readyButtonNote: null,
        nextPhaseLabel: 'NEXT PHASE',
        readyDisabled: true,
        readyDisabledReason: 'No game loaded',
        readySelected: false,
        spectatorCount: 0,
        isSpectatorViewer: false,
      },
      actionPanel: {
        activePanelId: 'ap.catalog.ships.human',
        tabs: [],
        buildCatalogue: {
          context: 'reference_only',
          canAddShipById: {},
          displayCostByShipId: {},
          eligibilityByShipId: {},
        },
          menu: {
              title: 'Menu',
              subtitle: 'Game Options',
              turnNumber: 0,
              phaseKey: 'setup.loading',
              isSpectator: false,
              hasActionsForMe: false,
              canOfferDraw: false,
              canResign: false,
              canAbortGame: false,
          },
        availableActions: [],
        selectedChoiceIdBySourceInstanceId: {},
        healthResolutionOverlay: undefined,
        ancientAutocastEnabled: false,
      },
    };
    
    const bootstrapActions: GameSessionActions = {
      onReadyToggle: () => {},
      onUndoActions: () => {},
      onOpenMenu: () => {},
      onActionPanelTabClick: () => {},
      onShipClick: () => {},
      onSendChat: () => {},
      onAcceptDraw: () => {},
      onRefuseDraw: () => {},
      onOpenBattleLogFullscreen: () => {},
      onSelectSpecies: () => {},
      onSelectBotSpecies: () => {},
      onConfirmSpecies: () => {},
      onCopyGameUrl: () => {},
      onBuildShip: () => {},
      onOfferDraw: () => {},
      onResignGame: () => {},
      onRematch: () => {},
      onDownloadBattleLog: () => { },
      onSelectShipChoiceForInstance: () => { },
      onCastAncientSolarPower: () => { },
      onOpenAncientSolarSelector: () => { },
      onCancelAncientSolarSelector: () => { },
      onCastAncientSiphon: () => { },
      onSetAncientAutocastEnabled: () => { },
      onSelectCentaurChargeSubTab: () => { },
      onSelectFrigateTrigger: () => { },
      onSelectQuantumMysticNumber: () => { },
      onSelectEvolverChoice: () => { },
      onBoardBackgroundMouseDown: () => { },
      onDestroyTargetStackHoverChange: () => { },
      onDestroyTargetStackMouseDown: () => { },
    };
    
    return {
      vm: bootstrapVm,
      actions: bootstrapActions,
      loading: false,
      error: 'No gameId provided',
    };
  }
  
  return { vm: { ...vm, turnPhasePresentation }, actions, loading, error };
}
