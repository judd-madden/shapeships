// ============================================================================
// GAME ROUTES
// ============================================================================
// Core multiplayer game endpoints (create, join, state, actions)
// Mechanical extraction from index.tsx - NO BEHAVIOR CHANGES
//
// Extracted from lines 1439-2425 of original index.tsx
// ============================================================================

import type { Hono } from "npm:hono";
import { advancePhaseCore } from '../engine/phase/advancePhase.ts';
import { onEnterPhase } from '../engine/phase/onEnterPhase.ts';
import { syncPhaseFields } from '../engine/phase/syncPhaseFields.ts';
import { initializeClocks, ensurePlayerClock, accrueClocks, clocksAreLive } from '../engine/clock/clock.ts';
import type { TimeControlConfig } from '../engine/clock/clock.ts';
import { getBuildCommitKey } from '../engine/intent/IntentTypes.ts';
import { hasRevealed } from '../engine/intent/CommitStore.ts';
import { resolveBuildSubmitAuthoritatively } from '../engine/intent/buildSubmitResolution.ts';
import {
  getAcceptedDeclarationForCurrentBattle,
  getChargeDeclarationLegalityState,
  getSnappedOrdinaryChargeSourceIds,
  isAncientPlayer,
  resolveChargeDeclarationSource,
} from '../engine/intent/chargeDeclarationEligibility.ts';
import type {
  LastTurnBreakdownRow,
  ShipInstance,
} from '../engine/state/GameStateTypes.ts';
import { getShipActivationCueBatches } from '../engine/state/shipActivationCues.ts';
import {
  normalizeAncientGameState,
  projectPublicAncientState,
  projectPublicPlayersForClient,
  projectPublicShipsForClient,
  sanitizeAncientStateForClient,
  type AncientCompatibilityRisk,
} from '../engine/state/ancientState.ts';
import {
  projectChargeDeclarationStateForViewer,
} from '../engine/state/chargeDeclarationVisibility.ts';
import {
  projectDrawingPreludeCarrierActions,
  projectDrawingPreludeRequesterSummary,
  projectPrivateDrawingPreludeCuesForRequester,
  redactPrivateDrawingPreludeCuesForPublic,
} from '../engine/state/drawingPreludeProjection.ts';
import { buildPhaseKey } from '../engine_shared/phase/PhaseTable.ts';
import { computeLineBonusesForPlayer } from '../engine/lines/computeLineBonusForPlayer.ts';
import { fleetHasAvailablePowers } from '../engine/phase/fleetHasAvailablePowers.ts';
import { getShipDefinition } from '../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import type { StructuredShipPower } from '../engine_shared/effects/translateShipPowers.ts';
import { EffectKind } from '../engine_shared/effects/Effect.ts';
import {
  getReservedFirstStrikeTargetInstanceIds,
  getValidDestroyTargets,
  getValidShipOfEqualityTargets,
  getValidTransferTargets,
} from '../engine_shared/resolve/destroyRules.ts';
import { isThirdSpiralFirstStrikeEligible } from '../engine_shared/resolve/thirdSpiralFirstStrikeEligibility.ts';
import { countDistinctTypes } from '../engine_shared/resolve/phaseComputedEffects.ts';
import {
  appendBattleLogTurnSummaryIdempotently,
  createEmptyBattleLogHistoryStore,
  getBattleLogArchiveCheckpointFromState,
  getBattleLogHistoryKey,
  normalizeBattleLogHistoryStore,
  toBattleLogHistoryResponse,
} from '../engine/state/battleLogHistory.ts';
import { appendChatEntry } from './chat_kv.ts';
import { ensureStateRevision, withBumpedStateRevision } from './state_revision.ts';
import { debugLog } from '../utils/serverLogger.ts';
import type { IntentPersistence } from './intent_persistence.ts';
import { getPlayerMaxHealth } from '../engine_shared/maximumHealth.ts';
import { getCubeDiceActionForPlayer } from '../engine/phase/cubeDiceManipulation.ts';
import { projectPublicTurnPhaseProgress } from '../engine/phase/turnPhaseProgress.ts';

const INITIAL_SAVED_LINES = 3;

function logAncientCompatibilityRisks(
  boundary: string,
  risks: AncientCompatibilityRisk[],
): void {
  if (risks.length === 0) return;
  const orderedRisks = [...new Map(
    risks.map((risk) => [
      `${risk.path}\u0000${risk.code}\u0000${risk.stableId ?? ''}`,
      risk,
    ]),
  ).values()].sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.code.localeCompare(b.code) ||
    (a.stableId ?? '').localeCompare(b.stableId ?? '')
  );
  console.warn('[AncientState] Canonical compatibility repair persisted', {
    boundary,
    risks: orderedRisks,
  });
}

const PRIVATE_GAME_TIMED_PRESETS = {
  '5_0': { minutes: 5, incrementSeconds: 0, baseMs: 300_000, incrementMs: 0 },
  '10_5': { minutes: 10, incrementSeconds: 5, baseMs: 600_000, incrementMs: 5_000 },
  '15_10': { minutes: 15, incrementSeconds: 10, baseMs: 900_000, incrementMs: 10_000 },
  '30_20': { minutes: 30, incrementSeconds: 20, baseMs: 1_800_000, incrementMs: 20_000 },
} as const;

const LEGACY_PRIVATE_GAME_PRESET_KEY = '15_10' as const;

type CreateGameRequestBody = {
  playerName?: unknown;
  timed?: unknown;
  minutes?: unknown;
  incrementSeconds?: unknown;
  variantKey?: unknown;
};

type CreateComputerGameRequestBody = CreateGameRequestBody & {
  planId?: unknown;
};

function toTimeControlConfig(preset: (typeof PRIVATE_GAME_TIMED_PRESETS)[keyof typeof PRIVATE_GAME_TIMED_PRESETS]): TimeControlConfig {
  return {
    baseMs: preset.baseMs,
    incrementMs: preset.incrementMs,
  };
}

function resolveTimedPrivateGamePreset(
  minutes: unknown,
  incrementSeconds: unknown,
): TimeControlConfig | null {
  for (const preset of Object.values(PRIVATE_GAME_TIMED_PRESETS)) {
    if (preset.minutes === minutes && preset.incrementSeconds === incrementSeconds) {
      return toTimeControlConfig(preset);
    }
  }

  return null;
}

function resolveCreateGameTimeControl(body: CreateGameRequestBody): TimeControlConfig | null {
  if (body.timed === undefined) {
    return toTimeControlConfig(PRIVATE_GAME_TIMED_PRESETS[LEGACY_PRIVATE_GAME_PRESET_KEY]);
  }

  if (body.timed === false) {
    return null;
  }

  if (body.timed !== true) {
    throw new Error('timed must be a boolean when provided');
  }

  const timeControl = resolveTimedPrivateGamePreset(body.minutes, body.incrementSeconds);
  if (!timeControl) {
    throw new Error('Invalid timed preset. Supported presets are 5+0, 10+5, 15+10, and 30+20.');
  }

  return timeControl;
}

function createFreshGameData(
  gameId: string,
  playerId: string,
  playerName: string,
  timeControl?: TimeControlConfig | null,
) {
  const nowIso = new Date().toISOString();

  let gameData = {
    gameId,
    players: [
      {
        id: playerId,
        name: playerName,
        faction: null,
        isReady: false,
        isActive: true,
        role: 'player',
        joinedAt: nowIso,
        health: 25,
        lines: INITIAL_SAVED_LINES,
        joiningLines: 0
      }
    ],
    gameData: {
      ships: {
        [playerId]: []
      },
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      turnNumber: 0,
      diceRoll: null,
      turnData: {
        turnNumber: 0,
        currentMajorPhase: 'setup',
        currentSubPhase: 'species_selection',
        requiredSubPhases: [],
        accumulatedDamage: {},
        accumulatedHealing: {},
        healthAtTurnStart: {},
        diceRoll: null,
        linesDistributed: false
      },
      phaseReadiness: [],
      phaseStartTime: nowIso
    },
    currentPhase: 'setup',
    currentSubPhase: 'species_selection',
    turnNumber: 0,
    actions: [
      {
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `${playerName} joined as a player`,
        timestamp: nowIso
      }
    ],
    status: "waiting",
    createdAt: nowIso,
    stateRevision: 1,
  };

  gameData = initializeClocks(gameData, timeControl);
  gameData = syncPhaseFields(gameData);
  gameData = normalizeAncientGameState(gameData).state;

  return gameData;
}

function createFreshComputerGameData(
  gameId: string,
  playerId: string,
  playerName: string,
  timeControl?: TimeControlConfig | null,
){
  const nowIso = new Date().toISOString();
  const botPlayerId = `bot_${gameId}`;

  let gameData = {
    gameId,
    players: [
      {
        id: playerId,
        name: playerName,
        faction: null,
        isReady: false,
        isActive: true,
        role: 'player',
        joinedAt: nowIso,
        health: 25,
        lines: INITIAL_SAVED_LINES,
        joiningLines: 0,
      },
      {
        id: botPlayerId,
        name: 'Computer',
        faction: null,
        isReady: false,
        isActive: true,
        role: 'player',
        joinedAt: nowIso,
        health: 25,
        lines: INITIAL_SAVED_LINES,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      [playerId]: { kind: 'human' },
      [botPlayerId]: {
        kind: 'bot',
        speciesId: null,
        chosenPlanId: null,
      },
    },
    gameData: {
      ships: {
        [playerId]: [],
        [botPlayerId]: [],
      },
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      turnNumber: 0,
      diceRoll: null,
      turnData: {
        turnNumber: 0,
        currentMajorPhase: 'setup',
        currentSubPhase: 'species_selection',
        requiredSubPhases: [],
        accumulatedDamage: {},
        accumulatedHealing: {},
        healthAtTurnStart: {},
        diceRoll: null,
        linesDistributed: false,
      },
      phaseReadiness: [],
      phaseStartTime: nowIso,
    },
    currentPhase: 'setup',
    currentSubPhase: 'species_selection',
    turnNumber: 0,
    actions: [
      {
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `${playerName} created the game`,
        timestamp: nowIso,
      },
      {
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: "Game started! Players select species.",
        timestamp: nowIso,
      },
    ],
    status: "active",
    createdAt: nowIso,
    stateRevision: 1,
  };

  gameData = initializeClocks(gameData, timeControl);
  gameData = syncPhaseFields(gameData);
  gameData = normalizeAncientGameState(gameData).state;

  return gameData;
}

function getTargetedChoiceEffect(option: any) {
  if (!Array.isArray(option?.effects)) return null;
  return option.effects.find(
    (effect: any) =>
      effect?.kind === EffectKind.Destroy ||
      effect?.kind === EffectKind.TransferShip
  ) ?? null;
}

function getProjectedRequiredTargetCount(effect: any, validTargetCount: number): number {
  const rawRequiredTargetCount =
    typeof effect?.requiredTargetCount === 'number'
      ? effect.requiredTargetCount
      : effect?.count;
  const baseRequiredTargetCount =
    Number.isInteger(rawRequiredTargetCount) && rawRequiredTargetCount > 0
      ? rawRequiredTargetCount
      : 1;
  return Math.min(baseRequiredTargetCount, Math.max(1, validTargetCount));
}

function isFirstStrikePowerAvailableForShip(
  state: any,
  playerId: string,
  shipInstance: ShipInstance,
  actionId: string,
  power: any,
): boolean {
  if (
    shipInstance.shipDefId === 'SPI' &&
    !isThirdSpiralFirstStrikeEligible(state, playerId, shipInstance.instanceId)
  ) {
    return false;
  }

  if (power?.onceOnly === 'on_build_turn') {
    const currentTurnNumber: number = state?.gameData?.turnNumber ?? 1;
    if (shipInstance?.createdTurn !== currentTurnNumber) {
      return false;
    }
  }

  if (power?.onceOnly) {
    const onceOnlyFired = state?.gameData?.powerMemory?.onceOnlyFired ?? {};
    if (onceOnlyFired[`${shipInstance.instanceId}::${actionId}`] === true) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// HELPER: Get current phase key for readiness checking
// ============================================================================
function getPhaseKey(state: any): string | null {
  const major = state?.gameData?.currentPhase;
  const sub = state?.gameData?.currentSubPhase;
  if (!major || !sub) return null;
  return buildPhaseKey(major, sub);
}

function projectShipActivationCueBatches(
  value: unknown,
  currentPhaseKey: string | null,
  gameStatus: unknown,
  currentTurnNumber: number,
) {
  const batches = getShipActivationCueBatches(value);
  if (currentPhaseKey === 'battle.charge_declaration') {
    return batches.filter(
      (batch) =>
        batch.phaseKey !== 'battle.charge_declaration' ||
        batch.turnNumber !== currentTurnNumber
    );
  }
  return batches;
}

function projectRequesterShipActivationCueBatches(
  value: unknown,
  currentPhaseKey: string | null,
  gameStatus: unknown,
  currentTurnNumber: number,
  requestingPlayerId: string,
  participantRole: unknown
) {
  if (participantRole !== 'player') {
    return [];
  }

  if (currentPhaseKey === 'battle.charge_declaration') {
    return getShipActivationCueBatches(value)
      .filter(
        (batch) =>
          batch.turnNumber === currentTurnNumber &&
          batch.phaseKey === 'battle.charge_declaration'
      )
      .map((batch) => ({
        ...batch,
        sources: batch.sources.filter(
          (source) => source.playerId === requestingPlayerId
        ),
      }))
      .filter((batch) => batch.sources.length > 0);
  }

  if (
    gameStatus === 'finished' ||
    (typeof currentPhaseKey === 'string' && currentPhaseKey.startsWith('battle.'))
  ) {
    return [];
  }

  return [];
}

// ============================================================================
// HELPER: Get subphases for available actions check
// ============================================================================
function getSubphasesForAvailableActions(phaseKey: string | null): string[] {
  switch (phaseKey) {
    case 'battle.first_strike': return ['First Strike'];
    // Keep this minimal for now. Add more as you implement more player-input phases.
    default: return [];
  }
}

function getChargeSourceShipsForPhase(state: any, playerId: string, phaseKey: string): ShipInstance[] {
  if (phaseKey !== 'battle.charge_declaration') {
    return [];
  }

  const sourceShips: ShipInstance[] = [];

  for (const sourceInstanceId of getSnappedOrdinaryChargeSourceIds(state, playerId)) {
    const ship = resolveChargeDeclarationSource(state, playerId, sourceInstanceId);
    if (!ship) continue;
    sourceShips.push(ship);
  }

  return sourceShips;
}

function getProjectedChoiceMetadataForChargeAction(
  state: any,
  playerId: string,
  phaseKey: string,
  shipDefId: string,
  liveFleet: ShipInstance[],
  choiceId: string
) {
  if (shipDefId === 'FAM' && (choiceId === 'damage' || choiceId === 'heal')) {
    const snapshot = phaseKey === 'battle.charge_declaration'
      ? state?.gameData?.turnData?.chargeDeclarationFleetSnapshotByPlayerId?.[playerId]
      : undefined;
    const countFleet = Array.isArray(snapshot) ? snapshot : liveFleet;

    return {
      choiceId,
      projectedAmount: countDistinctTypes(countFleet),
    };
  }

  return { choiceId };
}

type KnoRerollPassIndex = 1 | 2 | 3;

function getKnoRerollPassIndex(state: any): KnoRerollPassIndex {
  const passIndex = state?.gameData?.turnData?.knoRerollPassIndex;
  return passIndex === 2 || passIndex === 3 ? passIndex : 1;
}

function getKnoCountForPlayer(state: any, playerId: string): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return Array.isArray(fleet)
    ? fleet.filter((ship: any) => ship?.shipDefId === 'KNO').length
    : 0;
}

function getKnoMaxRerollPassCountForPlayer(state: any, playerId: string): KnoRerollPassIndex | 0 {
  return Math.min(3, getKnoCountForPlayer(state, playerId)) as KnoRerollPassIndex | 0;
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

function getRepresentativeKnoInstanceIdForPass(state: any, playerId: string, passIndex: KnoRerollPassIndex): string | null {
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

function projectDiceManipulationTurnData(gameData: any, requestingPlayerId: string): any {
  const turnData = gameData?.gameData?.turnData;
  if (!turnData) return gameData;

  const filteredPendingKnoRerollChoiceByPassByPlayerId: Record<string, Partial<Record<KnoRerollPassIndex, 'reroll' | 'hold'>>> = {};
  if (turnData.pendingKnoRerollChoiceByPassByPlayerId?.[requestingPlayerId]) {
    filteredPendingKnoRerollChoiceByPassByPlayerId[requestingPlayerId] =
      turnData.pendingKnoRerollChoiceByPassByPlayerId[requestingPlayerId];
  }
  const filteredPendingCubeDiceChoiceByPlayerId: Record<string, string> = {};
  if (turnData.pendingCubeDiceChoiceByPlayerId?.[requestingPlayerId]) {
    filteredPendingCubeDiceChoiceByPlayerId[requestingPlayerId] =
      turnData.pendingCubeDiceChoiceByPlayerId[requestingPlayerId];
  }
  const {
    cubeDiceRollsByPlayerId: _omitCubeDiceRollsByPlayerId,
    cubeDiceSelectionByPlayerId: _omitCubeDiceSelectionByPlayerId,
    ...projectedTurnData
  } = turnData;

  return {
    ...gameData,
    gameData: {
      ...gameData.gameData,
      turnData: {
        ...projectedTurnData,
        chronoswarmRolls: Array.isArray(turnData.chronoswarmRolls)
          ? turnData.chronoswarmRolls.filter((roll: unknown): roll is number => typeof roll === 'number')
          : [],
        chronoswarmCountByPlayerId: {
          ...(turnData.chronoswarmCountByPlayerId || {}),
        },
        knoRerollPassIndex:
          turnData.knoRerollPassIndex === 3
            ? 3
            : turnData.knoRerollPassIndex === 2
              ? 2
              : turnData.knoRerollPassIndex === 1
              ? 1
              : undefined,
        pendingKnoRerollChoiceByPassByPlayerId: filteredPendingKnoRerollChoiceByPassByPlayerId,
        pendingCubeDiceChoiceByPlayerId: filteredPendingCubeDiceChoiceByPlayerId,
        chronoswarmSharedRollCount:
          typeof turnData.chronoswarmSharedRollCount === 'number'
            ? turnData.chronoswarmSharedRollCount
            : undefined,
      },
    },
  };
}

function getPublicSavedResourcesForPlayer(state: any, phaseKey: string | null, playerId: string): {
  savedLines: number;
  savedJoiningLines: number;
} {
  const player = (state?.players || []).find((candidate: any) => candidate?.id === playerId);
  const snapshot =
    phaseKey === 'build.drawing'
      ? state?.gameData?.turnData?.buildDrawingPublicSavedResourcesByPlayerId?.[playerId]
      : null;

  return {
    savedLines: snapshot?.savedLines ?? player?.lines ?? 0,
    savedJoiningLines: snapshot?.savedJoiningLines ?? player?.joiningLines ?? 0,
  };
}

// ============================================================================
// HELPER: Compute available actions for requesting player
// ============================================================================
function computeAvailableActionsForRequestingPlayer(state: any, playerId: string): any[] {
  const phaseKey = getPhaseKey(state);

  if (!phaseKey) return [];

  if (phaseKey === 'build.drawing') {
    return projectDrawingPreludeCarrierActions(state, playerId);
  }

  if (phaseKey === 'build.dice_roll') {
    if (state?.gameData?.turnData?.diceManipulationStage === 'cube') {
      const cubeAction = getCubeDiceActionForPlayer(state, playerId);
      return cubeAction ? [cubeAction] : [];
    }
    if (state?.gameData?.turnData?.diceManipulationStage !== 'kno') {
      return [];
    }

    const passIndex = getKnoRerollPassIndex(state);
    if (!playerCanActInKnoRerollPass(state, playerId, passIndex)) {
      return [];
    }

    const sourceInstanceId = getRepresentativeKnoInstanceIdForPass(state, playerId, passIndex);
    if (!sourceInstanceId) {
      return [];
    }

    return [
      {
        kind: 'choice',
        actionId: 'KNO#0',
        shipDefId: 'KNO',
        sourceInstanceId,
        choices: [{ choiceId: 'reroll' }, { choiceId: 'hold' }],
      },
    ];
  }

  // ============================================================================
  // CHARGE DECLARATION: Derive choice actions from structured powers
  // ============================================================================
  if (phaseKey === 'battle.charge_declaration') {
    const declarationTargetState = getChargeDeclarationLegalityState(state);
    const currentSubPhase = state?.gameData?.currentSubPhase;
    const readiness = (state?.gameData?.phaseReadiness ?? []).find(
      (entry: any) =>
        entry?.playerId === playerId &&
        entry?.isReady === true &&
        (entry?.currentStep === phaseKey || entry?.currentStep === currentSubPhase),
    );
    if (readiness) return [];
    if (
      phaseKey === 'battle.charge_declaration' &&
      isAncientPlayer(state, playerId) &&
      getAcceptedDeclarationForCurrentBattle(state, playerId)
    ) {
      return [];
    }
    const actions: any[] = [];
    
    // Phase 3.1 Slice 2 — Patch C: Hide charge actions already used this turn (server truth)
    const turnNumber: number = state?.gameData?.turnNumber ?? 1;
    const usedMap: Record<string, number> =
      state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};
    
    // Keep live fleet for current legality and projections.
    const fleet = state?.gameData?.ships?.[playerId] ?? [];
    const sourceShips = getChargeSourceShipsForPhase(state, playerId, phaseKey);
    
    // For each ship instance, find eligible choice powers
    for (const shipInstance of sourceShips) {
      const shipDefId = shipInstance.shipDefId;
      const sourceInstanceId = shipInstance.instanceId;
      
      // Load ship definition with structured powers
      const shipDef = getShipDefinition(shipDefId);
      if (!shipDef || !shipDef.structuredPowers) continue;
      
      // For each structured power (powerIndex = array position)
      for (let powerIndex = 0; powerIndex < shipDef.structuredPowers.length; powerIndex++) {
        const power: StructuredShipPower = shipDef.structuredPowers[powerIndex];
        
        // Only consider choice powers
        if (power.type !== 'choice') continue;
        
        // Only consider powers whose timings include current phase
        if (!power.timings.includes(phaseKey)) continue;
        
        // Check charge eligibility
        const actionRequiresCharge =
          (power.requiresCharge ?? false) ||
          (Array.isArray(power.options) && power.options.some((o: any) => o?.requiresCharge === true));
        
        // Patch C: If this power requires charge and this ship already spent a charge this turn, it is not eligible.
        if (actionRequiresCharge && usedMap[sourceInstanceId] === turnNumber) continue;
        
        if (actionRequiresCharge) {
          const chargesCurrent = shipInstance.chargesCurrent ?? 0;
          // If power-level chargeCost exists use it, otherwise default to 1
          const chargeCost = power.chargeCost ?? 1;
          if (chargesCurrent < chargeCost) continue; // Not eligible
        }
        
        // Emit choice action
        const actionId = `${shipDefId}#${powerIndex}`;
        const choices = power.options.map((opt) =>
          getProjectedChoiceMetadataForChargeAction(
            state,
            playerId,
            phaseKey,
            shipDefId,
            fleet,
            opt.choiceId
          )
        );

        if (shipDefId === 'EQU') {
          const { validOwnTargets, validOpponentTargets } = getValidShipOfEqualityTargets(
            declarationTargetState,
            playerId
          );

          if (validOwnTargets.length === 0 || validOpponentTargets.length === 0) {
            continue;
          }

          actions.push({
            kind: 'paired_destroy_target',
            actionId,
            shipDefId,
            sourceInstanceId,
            choices,
            validOwnTargets,
            validOpponentTargets,
            requiredTargetCount: 2,
          });
          continue;
        }
        
        actions.push({
          kind: 'choice',
          actionId,
          shipDefId,
          sourceInstanceId,
          choices
        });
      }
    }
    
    // Stable ordering: by shipDefId, then instanceId, then actionId
    actions.sort((a, b) => {
      if (a.shipDefId !== b.shipDefId) {
        return a.shipDefId.localeCompare(b.shipDefId);
      }
      if (a.sourceInstanceId !== b.sourceInstanceId) {
        return a.sourceInstanceId.localeCompare(b.sourceInstanceId);
      }
      return a.actionId.localeCompare(b.actionId);
    });
    
    return actions;
  }

  // ============================================================================
  // BATTLE.FirstStrike: Derive targeted destroy actions from structured powers (Guardian)
  // ============================================================================
  if (phaseKey === 'battle.first_strike') {
    const actions: any[] = [];

    const turnNumber: number = state?.gameData?.turnNumber ?? 1;
    const usedMap: Record<string, number> =
      state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};

    const fleet = state?.gameData?.ships?.[playerId] ?? [];
    const opponentId = (state?.players || []).find((p: any) => p.role === 'player' && p.id !== playerId)?.id;

    for (const shipInstance of fleet) {
      const shipDefId = shipInstance.shipDefId;
      const sourceInstanceId = shipInstance.instanceId;

      const shipDef = getShipDefinition(shipDefId);
      if (!shipDef || !shipDef.structuredPowers) continue;

      for (let powerIndex = 0; powerIndex < shipDef.structuredPowers.length; powerIndex++) {
        const power: StructuredShipPower = shipDef.structuredPowers[powerIndex];
        if (power.type !== 'choice') continue;
        if (!power.timings.includes(phaseKey)) continue;

        const requiresCharge =
          (power.requiresCharge ?? false) ||
          (Array.isArray((power as any).options) && (power as any).options.some((o: any) => (o?.requiresCharge ?? false) === true));

        if (requiresCharge && usedMap[sourceInstanceId] === turnNumber) continue;
        if (requiresCharge) {
          const chargesCurrent = shipInstance.chargesCurrent ?? 0;
          const chargeCost = power.chargeCost ?? 1;
          if (chargesCurrent < chargeCost) continue;
        }

        const actionId = `${shipDefId}#${powerIndex}`;
        if (!isFirstStrikePowerAvailableForShip(state, playerId, shipInstance, actionId, power)) continue;

        const choices = power.options.map((opt: any) => ({ choiceId: opt.choiceId }));
        const targetedOption = power.options.find((opt: any) => getTargetedChoiceEffect(opt) != null);
        if (!targetedOption || !opponentId) continue;

        const targetedEffect = getTargetedChoiceEffect(targetedOption);
        if (!targetedEffect) continue;

        const targetArgs = {
          sourcePlayerId: playerId,
          targetScope: targetedEffect.targetPlayer === 'self' ? 'self' : 'opponent',
          restriction: targetedEffect.restriction ?? 'any',
        } as const;
        const powerSpecificValidTargets = targetedEffect.kind === EffectKind.TransferShip
          ? getValidTransferTargets(state, targetArgs)
          : getValidDestroyTargets(state, targetArgs);
        const reservedTargetIds = new Set(
          getReservedFirstStrikeTargetInstanceIds(state, playerId, sourceInstanceId),
        );
        const validTargets = powerSpecificValidTargets.filter(
          (target) => !reservedTargetIds.has(target.instanceId),
        );

        if (validTargets.length === 0) {
          continue;
        }

        actions.push({
          kind: 'destroy_target',
          actionId: `${shipDefId}#${powerIndex}`,
          shipDefId,
          sourceInstanceId,
          choices,
          validTargets,
          requiredTargetCount: getProjectedRequiredTargetCount(targetedEffect, validTargets.length),
        });
      }
    }

    actions.sort((a, b) => {
      if (a.shipDefId !== b.shipDefId) return a.shipDefId.localeCompare(b.shipDefId);
      if (a.sourceInstanceId !== b.sourceInstanceId) return a.sourceInstanceId.localeCompare(b.sourceInstanceId);
      return a.actionId.localeCompare(b.actionId);
    });

    return actions;
  }

  // ============================================================================
  // OTHER PHASES: Use fleetHasAvailablePowers (unchanged)
  // ============================================================================
  const subphases = getSubphasesForAvailableActions(phaseKey);
  if (subphases.length === 0) return [];

  return fleetHasAvailablePowers(state, phaseKey as any, playerId, subphases)
    ? [{ kind: 'phase_input', phaseKey }]
    : [];
}

// ============================================================================
// HELPER: Reconcile build.drawing if complete (Anti-Wedge Safety Net)
// ============================================================================
function reconcileBuildDrawingIfComplete(state: any, nowMs: number) {
  const phaseKey = getPhaseKey(state);
  if (!phaseKey || phaseKey !== 'build.drawing') return state;

  const turnNumber = state?.gameData?.turnNumber ?? state?.turnNumber ?? 0;
  const commitKey = getBuildCommitKey(turnNumber);

  const activePlayers = (state.players || []).filter((p: any) => p.role === 'player');
  if (activePlayers.length === 0) return state;

  // Completion condition: all active players have revealed BUILD_${turnNumber}
  const allSubmitted = activePlayers.every((p: any) => hasRevealed(state, commitKey, p.id));
  if (!allSubmitted) return state;

  // Ensure turnData exists
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};
  const resolution = resolveBuildSubmitAuthoritatively({
    state,
    turnNumber,
    nowMs,
  });
  state = resolution.state;

  if (resolution.alreadyApplied) {
    // Completed + already applied, so we only need to ensure phase advances
    console.warn('[reconcileBuildDrawingIfComplete] Builds already applied; attempting phase advance only.', {
      gameId: state.gameId,
      turnNumber,
      commitKey,
    });
  } else {
    console.warn('[reconcileBuildDrawingIfComplete] Detected completed BUILD_SUBMIT but not resolved. Applying authoritative build resolution now.', {
      gameId: state.gameId,
      turnNumber,
      commitKey,
    });
  }

  // Attempt phase advance (same approach as IntentReducer: core advance + onEnter)
  const fromKey = phaseKey;
  const adv = advancePhaseCore(state);

  if (!adv.ok) {
    console.error('[reconcileBuildDrawingIfComplete] Phase advance blocked:', adv.error);
    return state;
  }

  state = adv.state;

  // Clear readiness + sync after advance
  if (state?.gameData) {
    state.gameData.phaseReadiness = [];
  }
  state = syncPhaseFields(state);

  const toKey = getPhaseKey(state);

  // Trigger on-enter hooks
  if (toKey) {
    const onEnter = onEnterPhase(state, fromKey, toKey, nowMs);
    state = onEnter.state;
    // We do NOT push events into actions log here (GET route), just reconcile state.
  }

  console.warn('[reconcileBuildDrawingIfComplete] Phase advanced via reconciliation.', {
    gameId: state.gameId,
    from: fromKey,
    to: toKey,
    turnNumber,
  });

  return state;
}

// ============================================================================
// HELPER: Apply game-state maintenance pipeline for GET responses (read-only; no persistence)
// ============================================================================
function applyGameStateMaintenance(state: any, nowMs: number): any {
  let s = state;
  // Safe maintenance for GET responses only:
  // - syncPhaseFields: keep derived phase fields consistent
  // - accrueClocks: compute up-to-date clock view
  // IMPORTANT: Do NOT run reconciliation that can advance phases in GET.
  s = syncPhaseFields(s);
  s = accrueClocks(s, nowMs);
  return s;
}

function doesStateNeedPhaseSync(state: any): boolean {
  const gameData = state?.gameData ?? {};
  const turnData = gameData?.turnData ?? {};
  const major =
    gameData.currentPhase ??
    turnData.currentMajorPhase ??
    state?.currentPhase;
  const sub =
    gameData.currentSubPhase ??
    turnData.currentSubPhase ??
    state?.currentSubPhase;

  if (!major || !sub) {
    return false;
  }

  return (
    state?.currentPhase !== major ||
    state?.currentSubPhase !== sub ||
    gameData.currentPhase !== major ||
    gameData.currentSubPhase !== sub ||
    turnData.currentMajorPhase !== major ||
    turnData.currentSubPhase !== sub
  );
}

type PreparedGameStateRead =
  | {
      ok: true;
      maintainedState: any;
      nowMs: number;
      terminalOccurred: boolean;
      requestingPlayerId: string;
      participant: any;
    }
  | {
      ok: false;
      error: 'not_found' | 'forbidden';
    };

export function registerGameRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  requireSession: (c: any) => Promise<any>,
  generateGameId: () => string,
  loadPersistedRow: IntentPersistence['load'],
) {
  async function prepareGameStateRead(
    gameId: string,
    requestingPlayerId: string,
  ): Promise<PreparedGameStateRead> {
    const storedState = await kvGet(`game_${gameId}`);

    if (!storedState) {
      return { ok: false, error: 'not_found' };
    }

    const nowMs = Date.now();
    const prevStatus = storedState?.status;
    let maintainedState = applyGameStateMaintenance(
      ensureStateRevision(storedState),
      nowMs,
    );
    const nextStatus = maintainedState?.status;
    const terminalOccurred = prevStatus !== 'finished' && nextStatus === 'finished';
    const ancientNormalization = normalizeAncientGameState(maintainedState);
    maintainedState = ancientNormalization.state;

    if (terminalOccurred) {
      maintainedState = withBumpedStateRevision(maintainedState);
      await kvSet(`game_${gameId}`, maintainedState);
      logAncientCompatibilityRisks(
        'terminal-maintenance',
        ancientNormalization.compatibilityRisks,
      );
    }

    const participant = maintainedState?.players?.find(
      (player: any) => player?.id === requestingPlayerId,
    );
    if (!participant) {
      return { ok: false, error: 'forbidden' };
    }

    return {
      ok: true,
      maintainedState,
      nowMs,
      terminalOccurred,
      requestingPlayerId,
      participant,
    };
  }
  
  // ============================================================================
  // CREATE GAME
  // ============================================================================
  // Lines 1439-1525 from index.tsx
  app.post("/make-server-825e19ab/create-game", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const requestBody = await c.req.json() as CreateGameRequestBody;
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      const playerName =
        typeof requestBody?.playerName === 'string'
          ? requestBody.playerName.trim()
          : '';
      
      if (!playerName) {
        return c.json({ error: "Player name is required" }, 400);
      }

      let timeControl: TimeControlConfig | null;
      try {
        timeControl = resolveCreateGameTimeControl(requestBody);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid create-game settings';
        return c.json({ error: message }, 400);
      }

      debugLog(`Creating game - Session: ${session.sessionId}, Display name: ${playerName}`);

      const gameId = generateGameId();
      const gameData = ensureStateRevision(
        createFreshGameData(gameId, playerId, playerName, timeControl),
      );

      await kvSet(`game_${gameId}`, gameData);
      await kvSet(
        getBattleLogHistoryKey(gameId),
        createEmptyBattleLogHistoryStore(gameId),
      );
      
      debugLog("Game created:", gameId);
      return c.json({ gameId, message: "Game created successfully" });

    } catch (error) {
      console.error("Create game error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/make-server-825e19ab/create-computer-game", async (c) => {
    try {
      const session = await requireSession(c);
      if (session instanceof Response) return session;

      const requestBody = await c.req.json() as CreateComputerGameRequestBody;
      const playerId = session.sessionId;
      const playerName =
        typeof requestBody?.playerName === 'string'
          ? requestBody.playerName.trim()
          : '';

      if (!playerName) {
        return c.json({ error: "Player name is required" }, 400);
      }

      let timeControl: TimeControlConfig | null;
      try {
        timeControl = resolveCreateGameTimeControl(requestBody);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid create-computer-game settings';
        return c.json({ error: message }, 400);
      }

      const gameId = generateGameId();

      const gameData = createFreshComputerGameData(
        gameId,
        playerId,
        playerName,
        timeControl,
      );

      await kvSet(`game_${gameId}`, ensureStateRevision(gameData));
      await kvSet(
        getBattleLogHistoryKey(gameId),
        createEmptyBattleLogHistoryStore(gameId),
      );

      debugLog("Computer game created:", gameId, { chosenBotPlanId: null });
      return c.json({
        gameId,
        message: "Computer game created successfully",
        chosenBotPlanId: null,
      });
    } catch (error) {
      console.error("Create computer game error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/make-server-825e19ab/new-game-from/:gameId", async (c) => {
    try {
      const session = await requireSession(c);
      if (session instanceof Response) return session;

      const sourceGameId = c.req.param('gameId');
      const sourceGame = await kvGet(`game_${sourceGameId}`);

      if (!sourceGame) {
        return c.json({ error: "Game not found" }, 404);
      }

      const playerId = session.sessionId;
      const sourcePlayer = sourceGame.players.find((player: any) => player?.id === playerId);

      if (!sourcePlayer || sourcePlayer.role !== 'player') {
        return c.json({ error: "Only players from this finished game can create a new game" }, 403);
      }

      const playerName =
        typeof sourcePlayer.name === 'string'
          ? sourcePlayer.name.trim()
          : '';

      if (!playerName) {
        return c.json({ error: "Player name is required" }, 400);
      }

      if (sourceGame.status !== 'finished') {
        return c.json({ error: "New game can only be created from a finished game" }, 400);
      }

      const newGameId = generateGameId();
      const inheritedTimeControl = sourceGame?.gameData?.clock?.timeControl ?? null;
      const opponentPlayer = sourceGame.players.find((player: any) =>
        player?.role === 'player' && player?.id !== playerId
      );
      const opponentController = opponentPlayer?.id
        ? sourceGame.controllersByPlayerId?.[opponentPlayer.id]
        : null;
      const isBotRematch = opponentController?.kind === 'bot';

      if (isBotRematch) {
        const newGameData = createFreshComputerGameData(
          newGameId,
          playerId,
          playerName,
          inheritedTimeControl,
        );

        await kvSet(`game_${newGameId}`, ensureStateRevision(newGameData));
        await kvSet(
          getBattleLogHistoryKey(newGameId),
          createEmptyBattleLogHistoryStore(newGameId),
        );

        debugLog("Computer rematch created from finished bot game:", {
          sourceGameId,
          newGameId,
          playerId,
          opponentPlayerId: opponentPlayer?.id ?? null,
          chosenBotPlanId: null,
        });

        return c.json({ gameId: newGameId });
      }

      const newGameData = ensureStateRevision(
        createFreshGameData(
          newGameId,
          playerId,
          playerName,
          inheritedTimeControl,
        ),
      );

      await kvSet(`game_${newGameId}`, newGameData);
      await kvSet(
        getBattleLogHistoryKey(newGameId),
        createEmptyBattleLogHistoryStore(newGameId),
      );

      try {
        await appendChatEntry(
          sourceGameId,
          {
            type: 'rematch_invite',
            playerId,
            playerName,
            content: `${playerName} wants to play again`,
            newGameId,
            timestamp: Date.now(),
          },
          kvGet,
          kvSet,
        );
      } catch (error) {
        console.warn("Failed to append rematch invite to source game chat:", {
          sourceGameId,
          newGameId,
          playerId,
          error,
        });
      }

      debugLog("New game created from finished game:", {
        sourceGameId,
        newGameId,
        playerId,
      });

      return c.json({ gameId: newGameId });
    } catch (error) {
      console.error("New game from finished game error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // JOIN GAME
  // ============================================================================
  // Lines 1530-1622 from index.tsx
  app.post("/make-server-825e19ab/join-game/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      const { playerName } = await c.req.json();
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      if (!playerName) {
        return c.json({ error: "Player name is required" }, 400);
      }

      debugLog(`Joining game ${gameId} - Session: ${session.sessionId}, Display name: ${playerName}`);

      let gameData = await kvGet(`game_${gameId}`);
      if (!gameData) {
        return c.json({ error: "Game not found" }, 404);
      }
      gameData = ensureStateRevision(gameData);
      const ingressAncientNormalization = normalizeAncientGameState(gameData);
      gameData = ingressAncientNormalization.state;
      let didMutate = ingressAncientNormalization.changed;
      const ancientCompatibilityRisks = [
        ...ingressAncientNormalization.compatibilityRisks,
      ];

      const existingPlayer = gameData.players.find((p: any) => p.id === playerId);

      // Determine final role:
      // - Existing participants keep their stored role on rejoin.
      // - New participants fill player seats only while fewer than two players exist.
      const finalRole =
        existingPlayer
          ? existingPlayer.role === 'player' ? 'player' : 'spectator'
          : gameData.players.filter((p: any) => p.role === 'player').length < 2
            ? 'player'
            : 'spectator';
      
      if (!existingPlayer) {
        const newPlayer = {
          id: playerId, // Server-derived from sessionToken
          name: playerName, // Client-provided metadata
          faction: null, // Species to be selected
          isReady: false,
          isActive: finalRole === 'player', // PART C: All players are active (no longer just first player)
          role: finalRole,
          joinedAt: new Date().toISOString(),
          health: 25,
          lines: finalRole === 'player' ? INITIAL_SAVED_LINES : 0,
          joiningLines: 0
        };

        gameData.players.push(newPlayer);
        didMutate = true;

        // Initialize ship collection for players only (not spectators)
        if (finalRole === 'player') {
          if (!gameData.gameData) gameData.gameData = { ships: {} };
          if (!gameData.gameData.ships) gameData.gameData.ships = {};
          gameData.gameData.ships[playerId] = [];
          
          // Ensure clock is initialized for this player using immutable helper
          if (gameData.gameData?.clock) {
            gameData.gameData.clock = ensurePlayerClock(gameData.gameData.clock, playerId);
          }
        }

        // Internal game action only; visible chat storage stays lazy.
        const joinMessage = `${playerName} joined as a ${finalRole}`;

        gameData.actions.push({
          playerId: "system",
          playerName: "System",
          actionType: "system",
          content: joinMessage,
          timestamp: new Date().toISOString()
        });

        // Start the game if we have 2 active players
        const newActivePlayerCount = gameData.players.filter((p: any) => p.role === 'player').length;
        if (newActivePlayerCount >= 2 && gameData.status === 'waiting') {
          gameData.status = 'active';
          gameData.actions.push({
            playerId: "system",
            playerName: "System",
            actionType: "system",
            content: "Game started! Players select species.",
            timestamp: new Date().toISOString()
          });
        }
        
        // PART C: Log activation
        debugLog("JOIN_GAME_ACTIVATED_PLAYER", {
          gameId,
          sessionId: playerId,
          role: finalRole,
          isActive: finalRole === 'player',
        });
      } else {
        // PART C: Rejoin - idempotently preserve existing player/spectator roles.
        
        // If finalRole is 'player', ensure the existing player is active
        if (finalRole === 'player') {
          // Always set isActive=true for players (idempotent)
          if (existingPlayer.isActive !== true) {
            existingPlayer.isActive = true;
            didMutate = true;
          }

          if (!gameData.gameData) {
            gameData.gameData = { ships: {} };
            didMutate = true;
          }
          if (!gameData.gameData.ships) {
            gameData.gameData.ships = {};
            didMutate = true;
          }
          if (!Array.isArray(gameData.gameData.ships[playerId])) {
            gameData.gameData.ships[playerId] = [];
            didMutate = true;
          }
          if (gameData.gameData?.clock) {
            const nextClock = ensurePlayerClock(gameData.gameData.clock, playerId);
            if (nextClock !== gameData.gameData.clock) {
              gameData.gameData.clock = nextClock;
              didMutate = true;
            }
          }
          
          debugLog("JOIN_GAME_REACTIVATED_PLAYER", {
            gameId,
            sessionId: playerId,
            role: existingPlayer.role,
            isActive: true,
          });
        } else {
          // finalRole is 'spectator' - ensure isActive is false
          if (existingPlayer.isActive !== false) {
            existingPlayer.isActive = false;
            didMutate = true;
          }
        }
      }

      // Normalize phase fields before saving
      if (doesStateNeedPhaseSync(gameData)) {
        didMutate = true;
      }
      gameData = syncPhaseFields(gameData);

      const egressAncientNormalization = normalizeAncientGameState(gameData);
      gameData = egressAncientNormalization.state;
      didMutate ||= egressAncientNormalization.changed;
      ancientCompatibilityRisks.push(
        ...egressAncientNormalization.compatibilityRisks,
      );

      if (didMutate) {
        gameData = withBumpedStateRevision(gameData);
        await kvSet(`game_${gameId}`, gameData);
        logAncientCompatibilityRisks('join-game', ancientCompatibilityRisks);
      }
      
      debugLog("Player joined game:", gameId, playerName);
      return c.json({
        message: "Joined game successfully",
        gameData: sanitizeAncientStateForClient(gameData, playerId),
      });

    } catch (error) {
      console.error("Join game error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // SWITCH ROLE
  // ============================================================================
  // Lines 1627-1731 from index.tsx
  app.post("/make-server-825e19ab/switch-role/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      const { newRole } = await c.req.json();
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      if (!newRole) {
        return c.json({ error: "New role is required" }, 400);
      }

      if (!['player', 'spectator'].includes(newRole)) {
        return c.json({ error: "Role must be 'player' or 'spectator'" }, 400);
      }

      debugLog(`Role switch from session ${session.sessionId}: ${newRole} in game ${gameId}`);

      let gameData = await kvGet(`game_${gameId}`);
      if (!gameData) {
        return c.json({ error: "Game not found" }, 404);
      }
      gameData = ensureStateRevision(gameData);
      const ingressAncientNormalization = normalizeAncientGameState(gameData);
      gameData = ingressAncientNormalization.state;
      let didMutate = ingressAncientNormalization.changed;
      const ancientCompatibilityRisks = [
        ...ingressAncientNormalization.compatibilityRisks,
      ];

      const player = gameData.players.find((p: any) => p.id === playerId);
      if (!player) {
        return c.json({ error: "Player not in game (session not recognized)" }, 403);
      }

      // Check if switching to player but game already has 2 players
      const activePlayers = gameData.players.filter((p: any) => p.role === 'player');
      if (newRole === 'player' && activePlayers.length >= 2 && player.role !== 'player') {
        return c.json({ error: "Game already has 2 active players" }, 400);
      }

      const oldRole = player.role;
      const isPromotingToPlayer = oldRole !== 'player' && newRole === 'player';
      
      // Find player index to update the player properly
      const playerIndex = gameData.players.findIndex((p: any) => p.id === playerId);
      if (playerIndex === -1) {
        return c.json({ error: "Player not found in game" }, 404);
      }
      
      // Update player resources based on new role - immutable update
      if (newRole === 'player') {
        // Initialize ship collection if needed
        if (!gameData.gameData) {
          gameData.gameData = { ships: {} };
          didMutate = true;
        }
        if (!gameData.gameData.ships) {
          gameData.gameData.ships = {};
          didMutate = true;
        }
        if (!gameData.gameData.ships[playerId]) {
          gameData.gameData.ships[playerId] = [];
          didMutate = true;
        }
        if (gameData.gameData?.clock) {
          const nextClock = ensurePlayerClock(gameData.gameData.clock, playerId);
          if (nextClock !== gameData.gameData.clock) {
            gameData.gameData.clock = nextClock;
            didMutate = true;
          }
        }

        const nextPlayers = gameData.players.map((p: any, idx: number) => {
          if (idx !== playerIndex) {
            return p;
          }

          const nextPlayer = {
            ...p,
            role: newRole,
            lines: isPromotingToPlayer ? (p.lines || INITIAL_SAVED_LINES) : p.lines,
            health: 25,
          };

          if (
            nextPlayer.role !== p.role ||
            nextPlayer.lines !== p.lines ||
            nextPlayer.health !== p.health
          ) {
            didMutate = true;
          }

          return nextPlayer;
        });

        gameData = {
          ...gameData,
          players: nextPlayers,
        };
      } else {
        // Switching to spectator - keep current resources but don't give new ones
        const nextPlayers = gameData.players.map((p: any, idx: number) => {
          if (idx !== playerIndex) {
            return p;
          }

          const nextPlayer = {
            ...p,
            role: newRole,
            isReady: false,
          };

          if (
            nextPlayer.role !== p.role ||
            nextPlayer.isReady !== p.isReady
          ) {
            didMutate = true;
          }

          return nextPlayer;
        });

        gameData = {
          ...gameData,
          players: nextPlayers,
        };
      }

      if (oldRole !== newRole) {
        const updatedPlayer = gameData.players[playerIndex];
        gameData.actions.push({
          playerId: "system",
          playerName: "System",
          actionType: "system",
          content: `${updatedPlayer.name} switched from ${oldRole} to ${newRole}`,
          timestamp: new Date().toISOString()
        });
        didMutate = true;
      }

      // Normalize phase fields before saving
      if (doesStateNeedPhaseSync(gameData)) {
        didMutate = true;
      }
      gameData = syncPhaseFields(gameData);

      const egressAncientNormalization = normalizeAncientGameState(gameData);
      gameData = egressAncientNormalization.state;
      didMutate ||= egressAncientNormalization.changed;
      ancientCompatibilityRisks.push(
        ...egressAncientNormalization.compatibilityRisks,
      );

      if (didMutate) {
        gameData = withBumpedStateRevision(gameData);
        await kvSet(`game_${gameId}`, gameData);
        logAncientCompatibilityRisks('switch-role', ancientCompatibilityRisks);
      }
      
      debugLog("Player switched role:", gameId, player.name, oldRole, "->", newRole);
      return c.json({
        message: "Role switched successfully",
        gameData: sanitizeAncientStateForClient(gameData, playerId),
      });

    } catch (error) {
      console.error("Switch role error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // GET GAME STATE
  // ============================================================================
  // Lines 1736-1856 from index.tsx
  app.get("/make-server-825e19ab/game-state/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      
      // Note: Client may send playerId query for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const requestingPlayerId = session.sessionId; // AUTHORITY: Server-minted identity

      const preparedRead = await prepareGameStateRead(gameId, requestingPlayerId);
      if (!preparedRead.ok) {
        if (preparedRead.error === 'not_found') {
          return c.json({ error: "Game not found" }, 404);
        }
        return c.json({ error: "Not authorized to view this game" }, 403);
      }

      const { maintainedState, nowMs, participant } = preparedRead;
      let gameData = maintainedState;

      const phaseKey = getPhaseKey(gameData);
      const sub = gameData.gameData.currentSubPhase;
      const phaseReadiness = gameData.gameData?.phaseReadiness || [];
      const inSpeciesSelection = phaseKey === 'setup.species_selection';

      gameData.players = gameData.players.map((player: any) => {
        const readiness = phaseReadiness.find((r: any) => r.playerId === player.id);

        // Support both new (major:sub) and older (sub only)
        const readyMatch =
          readiness?.currentStep === phaseKey ||
          readiness?.currentStep === sub;

        return {
          ...player,
          isReady: inSpeciesSelection
            ? false
            : Boolean(readiness?.isReady && readyMatch)
        };
      });

      // SECURITY: Filter pending declarations to only show requesting player's own pending data
      if (requestingPlayerId && gameData.gameData?.turnData) {
        const turnData = gameData.gameData.turnData;
        
        // Filter pending charge declarations
        if (turnData.pendingChargeDeclarations) {
          const filteredChargeDeclarations: Record<string, any[]> = {};
          // Only include requesting player's pending declarations
          if (turnData.pendingChargeDeclarations[requestingPlayerId]) {
            filteredChargeDeclarations[requestingPlayerId] = turnData.pendingChargeDeclarations[requestingPlayerId];
          }
          // For opponent, just show that they have pending declarations (count only)
          for (const playerId in turnData.pendingChargeDeclarations) {
            if (playerId !== requestingPlayerId) {
              filteredChargeDeclarations[playerId] = []; // Don't reveal opponent's declarations
            }
          }
          
          gameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...turnData,
                pendingChargeDeclarations: filteredChargeDeclarations
              }
            }
          };
        }
        
        // Filter pending first strike selections
        if (turnData.pendingFirstStrikeSelectionsByPlayerId) {
          const filteredSelections: Record<string, any> = {};
          if (turnData.pendingFirstStrikeSelectionsByPlayerId[requestingPlayerId]) {
            filteredSelections[requestingPlayerId] = turnData.pendingFirstStrikeSelectionsByPlayerId[requestingPlayerId];
          }

          gameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...turnData,
                pendingFirstStrikeSelectionsByPlayerId: filteredSelections
              }
            }
          };
        }

        // Filter commit/reveal data (new commit/reveal protocol)
        if (turnData.commitments) {
          const filteredCommitments: any = {};
          
          // For each commitment key (e.g., SPECIES_1, BUILD_2, etc.)
          for (const commitKey in turnData.commitments) {
            const keyRecords = turnData.commitments[commitKey];
            filteredCommitments[commitKey] = {};
            
            // For each player in this commitment key
            for (const playerId in keyRecords) {
              const record = keyRecords[playerId];
              
              if (playerId === requestingPlayerId) {
                // Show requesting player's own commit/reveal data
                filteredCommitments[commitKey][playerId] = record;
              } else {
                // For opponent: hide reveal payload and nonce, but show status booleans
                filteredCommitments[commitKey][playerId] = {
                  hasCommitted: record.commitHash !== undefined,
                  hasRevealed: record.revealPayload !== undefined,
                  committedAt: record.committedAt,
                  revealedAt: record.revealedAt
                  // Do NOT include: commitHash, revealPayload, nonce
                };
              }
            }
          }
          
          gameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...gameData.gameData.turnData,
                commitments: filteredCommitments
              }
            }
          };
        }
      }

      const availableActions = computeAvailableActionsForRequestingPlayer(
        gameData,
        requestingPlayerId,
      );
      gameData = projectDiceManipulationTurnData(gameData, requestingPlayerId);
      const declarationProjection = projectChargeDeclarationStateForViewer(
        gameData,
        requestingPlayerId,
      );
      const projectedGameData = declarationProjection.state;

      // Expose clock snapshot to client (STEP F)
      const clockData = gameData.gameData?.clock;
      const clockSnapshot = clockData ? {
        remainingMsByPlayerId: clockData.remainingMsByPlayerId,
        timeControl: clockData.timeControl,
        clocksAreLive: clocksAreLive(gameData),
        serverNowMs: nowMs,
      } : null;
      
      // Compute projected build-phase line bonuses for all players
      const bonusLinesByPlayerId: Record<string, number> = {};
      const bonusLinesOnEvenByPlayerId: Record<string, number> = {};
      const savedLinesByPlayerId: Record<string, number> = {};
      const joiningLinesByPlayerId: Record<string, number> = {};
      const joiningBonusLinesByPlayerId: Record<string, number> = {};
      const bonusBreakdownByPlayerId: Record<
        string,
        LastTurnBreakdownRow[]
      > = {};
      const buildEconomyByPlayerId: Record<string, {
        ordinaryLinesAvailable: number;
        joiningLinesAvailable: number;
        baseRollLines: number;
        ordinaryBonusLines: number;
        ordinaryBonusLinesOnEven: number;
        joiningBonusLines: number;
        chronoswarmBonusLines: number;
        linesDistributed: boolean;
      }> = {};
      const turnData = gameData.gameData?.turnData || {};
      const canonicalBaseRollLines =
        turnData.effectiveDiceRoll ??
        turnData.baseDiceRoll ??
        turnData.diceRoll;
      const chronoswarmRolls = Array.isArray(turnData.chronoswarmRolls)
        ? turnData.chronoswarmRolls.filter((roll: unknown): roll is number => typeof roll === 'number')
        : [];
      const playersInGame = projectedGameData.players || [];
      for (const player of playersInGame) {
        if (player.role === 'player') {
          const publicSavedResources = getPublicSavedResourcesForPlayer(
            projectedGameData,
            phaseKey,
            player.id,
          );
          const requesterOwnsEconomy =
            participant?.role === 'player' &&
            player.id === requestingPlayerId;
          const ordinaryLinesAvailable = requesterOwnsEconomy
            ? player.lines ?? 0
            : publicSavedResources.savedLines;
          const joiningLinesAvailable = requesterOwnsEconomy
            ? player.joiningLines ?? 0
            : publicSavedResources.savedJoiningLines;
          const baseRollLines = turnData.effectiveDiceRollByPlayerId?.[player.id] ?? canonicalBaseRollLines ?? 0;
          const chronoswarmCountRaw = turnData.chronoswarmCountByPlayerId?.[player.id];
          const chronoswarmCount =
            Number.isInteger(chronoswarmCountRaw) && chronoswarmCountRaw > 0
              ? Math.min(chronoswarmCountRaw, chronoswarmRolls.length)
              : 0;
          let chronoswarmBonusLines = 0;
          for (let i = 0; i < chronoswarmCount; i++) {
            chronoswarmBonusLines += chronoswarmRolls[i] ?? 0;
          }

          savedLinesByPlayerId[player.id] = publicSavedResources.savedLines;
          joiningLinesByPlayerId[player.id] = publicSavedResources.savedJoiningLines;
          if (!declarationProjection.structuralProjectionAvailable) {
            continue;
          }
          try {
            const lineBonuses = computeLineBonusesForPlayer(
              projectedGameData.gameData,
              player.id,
            );
            bonusLinesByPlayerId[player.id] = lineBonuses.bonusLines;
            bonusLinesOnEvenByPlayerId[player.id] = lineBonuses.bonusLinesOnEven;
            joiningBonusLinesByPlayerId[player.id] = lineBonuses.joiningBonusLines;
            bonusBreakdownByPlayerId[player.id] = [
              ...lineBonuses.ordinaryRows,
              ...lineBonuses.evenOnlyRows,
              ...lineBonuses.joiningRows,
            ].sort((a, b) => {
              if (b.amount !== a.amount) return b.amount - a.amount;
              return a.label.localeCompare(b.label);
            });
            buildEconomyByPlayerId[player.id] = {
              ordinaryLinesAvailable,
              joiningLinesAvailable,
              baseRollLines,
              ordinaryBonusLines: lineBonuses.bonusLines,
              ordinaryBonusLinesOnEven: lineBonuses.bonusLinesOnEven,
              joiningBonusLines: lineBonuses.joiningBonusLines,
              chronoswarmBonusLines,
              linesDistributed: turnData.linesDistributed === true,
            };
          } catch (err) {
            console.error(`[GET game-state] Failed to compute bonus lines for ${player.id}:`, err);
            bonusLinesByPlayerId[player.id] = 0; // Default to 0 on error
            bonusLinesOnEvenByPlayerId[player.id] = 0;
            joiningBonusLinesByPlayerId[player.id] = 0;
            bonusBreakdownByPlayerId[player.id] = [];
            buildEconomyByPlayerId[player.id] = {
              ordinaryLinesAvailable,
              joiningLinesAvailable,
              baseRollLines,
              ordinaryBonusLines: 0,
              ordinaryBonusLinesOnEven: 0,
              joiningBonusLines: 0,
              chronoswarmBonusLines,
              linesDistributed: turnData.linesDistributed === true,
            };
          }
        }
      }
      
      const publicAncientState = projectPublicAncientState(
        gameData,
        requestingPlayerId,
      );
      const clientSafeGameData = sanitizeAncientStateForClient(
        gameData,
        requestingPlayerId,
      );
      const publicShips = projectPublicShipsForClient(
        gameData,
        requestingPlayerId,
      );
      const {
        ships: _omitShips,
        battleLogScratch: _omitBattleLogScratch,
        ...responseState
      } = clientSafeGameData;
      const {
        shipActivationCueBatches: _omitShipActivationCueBatches,
        turnPhaseProgress: _omitTurnPhaseProgress,
        ...responseTurnData
      } = responseState.gameData?.turnData ?? {};
      const responseGameData = responseState.gameData
        ? {
            ...responseState.gameData,
            turnData: responseTurnData,
          }
        : responseState.gameData;
      const lastTurnDamageDealtBreakdownByPlayerId =
        gameData.gameData?.lastTurnDamageDealtBreakdownByPlayerId ?? {};
      const lastTurnHealingReceivedBreakdownByPlayerId =
        gameData.gameData?.lastTurnHealingReceivedBreakdownByPlayerId ?? {};
      const currentTurnNumber =
        turnData.turnNumber ??
        gameData.gameData?.turnNumber ??
        gameData.turnNumber ??
        0;
      const meta = {
        turnNumber: currentTurnNumber,
        phaseKey,
        subPhaseKey: sub ?? null,
      };
      const visibleDice = {
        diceRoll: turnData.diceRoll ?? gameData.gameData?.diceRoll ?? null,
        baseDiceRoll: turnData.baseDiceRoll ?? null,
        effectiveDiceRoll: turnData.effectiveDiceRoll ?? null,
        effectiveDiceRollByPlayerId: turnData.effectiveDiceRollByPlayerId ?? {},
        chronoswarmRolls: Array.isArray(turnData.chronoswarmRolls)
          ? turnData.chronoswarmRolls
          : [],
        cubeDiceValueByPlayerId: turnData.visibleCubeDiceValueByPlayerId ?? {},
      };
      const turnPhaseProgress = projectPublicTurnPhaseProgress(gameData);
      const publicState = {
        players: ((projectPublicPlayersForClient(
          gameData,
          requestingPlayerId,
        ) as any[]) ?? []).map((player: any) =>
          declarationProjection.structuralProjectionAvailable
            ? {
                ...player,
                maxHealth: getPlayerMaxHealth(projectedGameData, player.id),
              }
            : player
        ),
        phaseReadiness,
        clock: clockSnapshot,
        ships: publicShips,
        voidShipsByPlayerId:
          projectedGameData.gameData?.voidShipsByPlayerId ?? {},
        visibleDice,
        lastTurnStats: {
          netByPlayerId: gameData.gameData?.lastTurnNetByPlayerId ?? {},
          damageByPlayerId: gameData.gameData?.lastTurnDamageByPlayerId ?? {},
          healByPlayerId: gameData.gameData?.lastTurnHealByPlayerId ?? {},
        },
        controllersByPlayerId: gameData.controllersByPlayerId ?? gameData.gameData?.controllersByPlayerId ?? {},
        savedLinesByPlayerId,
        joiningLinesByPlayerId,
        bonusLinesByPlayerId,
        bonusLinesOnEvenByPlayerId,
        joiningBonusLinesByPlayerId,
        bonusBreakdownByPlayerId,
        presentationEvents: {
          shipActivationCueBatches: redactPrivateDrawingPreludeCuesForPublic(
            gameData,
            projectShipActivationCueBatches(
              turnData.shipActivationCueBatches,
              phaseKey,
              gameData.status,
              currentTurnNumber,
            ),
          ),
        },
        ancient: publicAncientState,
        ...(turnPhaseProgress
          ? { turnPhaseProgress }
          : {}),
      };
      const drawingPrelude = projectDrawingPreludeRequesterSummary(
        gameData,
        requestingPlayerId,
      );
      const requesterShipActivationCueBatches = [
        ...projectRequesterShipActivationCueBatches(
          turnData.shipActivationCueBatches,
          phaseKey,
          gameData.status,
          currentTurnNumber,
          requestingPlayerId,
          participant?.role
        ),
        ...projectPrivateDrawingPreludeCuesForRequester(
          gameData,
          turnData.shipActivationCueBatches,
          requestingPlayerId,
        ),
      ].sort((left, right) => left.seq - right.seq);
      const requester = {
        playerId: requestingPlayerId,
        availableActions,
        ...(drawingPrelude ? { drawingPrelude } : {}),
        buildEconomy: buildEconomyByPlayerId[requestingPlayerId] ?? null,
        buildEconomyByPlayerId,
        lastTurnDamageDealtBreakdownByPlayerId,
        lastTurnHealingReceivedBreakdownByPlayerId,
        presentationEvents: {
          shipActivationCueBatches: requesterShipActivationCueBatches,
        },
      };
      const result = {
        winnerPlayerId: gameData.winnerPlayerId ?? null,
        resultReason: gameData.resultReason ?? null,
      };
      
      return c.json({
        ...responseState,
        gameData: responseGameData,
        stateRevision: gameData.stateRevision,
        clock: clockSnapshot,
        meta,
        publicState,
        requester,
        result,
      });

    } catch (error) {
      console.error("Get game state error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.get("/make-server-825e19ab/game-state-head/:gameId", async (c) => {
    try {
      const session = await requireSession(c);
      if (session instanceof Response) return session;

      const gameId = c.req.param('gameId');
      const requestingPlayerId = session.sessionId;
      const preparedRead = await prepareGameStateRead(gameId, requestingPlayerId);

      if (!preparedRead.ok) {
        if (preparedRead.error === 'not_found') {
          return c.json({ error: "Game not found" }, 404);
        }
        return c.json({ error: "Not authorized to view this game" }, 403);
      }

      const { maintainedState, nowMs } = preparedRead;
      const phaseKey = getPhaseKey(maintainedState) ?? 'unknown';
      const clockData = maintainedState?.gameData?.clock;

      return c.json({
        gameId: maintainedState?.gameId ?? gameId,
        stateRevision: maintainedState.stateRevision,
        status: maintainedState?.status ?? 'unknown',
        turnNumber: maintainedState?.gameData?.turnNumber ?? maintainedState?.turnNumber ?? 0,
        phaseKey,
        clock: clockData
          ? {
              remainingMsByPlayerId: clockData.remainingMsByPlayerId ?? {},
              clocksAreLive: clocksAreLive(maintainedState),
              serverNowMs: nowMs,
            }
          : null,
      });
    } catch (error) {
      console.error("Get game state head error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.get("/make-server-825e19ab/game-history/:gameId", async (c) => {
    try {
      const session = await requireSession(c);
      if (session instanceof Response) return session;

      const gameId = c.req.param('gameId');
      const requestingPlayerId = session.sessionId;
      const gameLoad = await loadPersistedRow(`game_${gameId}`);

      if (gameLoad.status === 'error') {
        console.error('Get game history game-row read error:', gameLoad.error);
        return c.json({ error: "Internal server error" }, 500);
      }
      if (gameLoad.status === 'missing') {
        return c.json({ error: "Game not found" }, 404);
      }
      const gameData = gameLoad.value;

      const participant = gameData.players.find((p: any) => p.id === requestingPlayerId);
      if (!participant) {
        return c.json({ error: "Not authorized to view this game" }, 403);
      }

      const historyLoad = await loadPersistedRow(getBattleLogHistoryKey(gameId));
      if (historyLoad.status === 'error') {
        console.error('Get game history history-row read error:', historyLoad.error);
        return c.json({ error: "Internal server error" }, 500);
      }
      let historyStore = normalizeBattleLogHistoryStore(
        gameId,
        historyLoad.status === 'found' ? historyLoad.value : null,
      );
      const checkpoint = getBattleLogArchiveCheckpointFromState(gameData);
      if (checkpoint) {
        const mergeResult = appendBattleLogTurnSummaryIdempotently(
          historyStore,
          checkpoint.summary,
        );
        if (mergeResult.status === 'divergent') {
          console.error('[BattleLog] History GET found checkpoint divergence', {
            gameId,
            finalizedTurnNumber: checkpoint.finalizedTurnNumber,
            acceptedStateRevision: checkpoint.acceptedStateRevision,
          });
        } else {
          historyStore = mergeResult.historyStore;
        }
      }
      return c.json(toBattleLogHistoryResponse(historyStore));
    } catch (error) {
      console.error("Get game history error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
}
