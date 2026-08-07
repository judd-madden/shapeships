import type { EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import type {
  AncientPlayerEnergyState,
  AncientSolarLedgerState,
  ChargeDeclarationAcknowledgements,
  ChargeDeclarationVisibilitySnapshot,
  ShipInstance,
} from './GameStateTypes.ts';

export const CHARGE_DECLARATION_PHASE_KEY = 'battle.charge_declaration' as const;
export const CHARGE_DECLARATION_LEGALITY_INVARIANT =
  'CHARGE_DECLARATION_LEGALITY_SNAPSHOT_MISSING' as const;

type ProjectionFailureReason =
  | 'visibility_snapshot_missing_or_stale'
  | 'fleet_snapshot_missing_or_stale'
  | 'acknowledgements_missing_or_stale';

export type ChargeDeclarationViewerProjection = {
  state: any;
  active: boolean;
  structuralProjectionAvailable: boolean;
  acknowledgementsAvailable: boolean;
  failureReason?: ProjectionFailureReason;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPhaseKey(state: any): string | null {
  const gameData = state?.gameData;
  const major = gameData?.currentPhase ?? gameData?.turnData?.currentMajorPhase;
  const sub = gameData?.currentSubPhase ?? gameData?.turnData?.currentSubPhase;
  return typeof major === 'string' && typeof sub === 'string'
    ? `${major}.${sub}`
    : null;
}

export function getChargeDeclarationTurnNumber(state: any): number {
  const value =
    state?.gameData?.turnNumber ??
    state?.gameData?.turnData?.turnNumber ??
    state?.turnNumber ??
    0;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function isChargeDeclarationPrivacyActive(state: any): boolean {
  return getPhaseKey(state) === CHARGE_DECLARATION_PHASE_KEY;
}

function getActivePlayerIds(state: any): string[] {
  if (!Array.isArray(state?.players)) return [];
  return state.players
    .filter((player: any) => player?.role === 'player' && typeof player?.id === 'string')
    .map((player: any) => player.id as string)
    .sort((left: string, right: string) => left.localeCompare(right));
}

function createEmptyAncientEnergyState(): AncientPlayerEnergyState {
  return {
    battleTurnNumber: null,
    pool: { green: 0, red: 0, blue: 0 },
    sources: [],
  };
}

function createEmptyAncientSolarLedgerState(): AncientSolarLedgerState {
  return { battleTurnNumber: null, entries: [] };
}

export function replaceChargeDeclarationVisibilityState(state: any): void {
  const turnData = state?.gameData?.turnData;
  if (!isObject(turnData)) {
    throw new Error('Charge Declaration visibility capture requires turnData');
  }

  const battleTurnNumber = getChargeDeclarationTurnNumber(state);
  const voidShipsByPlayerId: Record<string, ShipInstance[]> = {};
  const healthByPlayerId: Record<string, number> = {};
  const ancientEnergyByPlayerId: Record<string, AncientPlayerEnergyState> = {};
  const ancientSolarLedgerByPlayerId: Record<string, AncientSolarLedgerState> = {};

  for (const playerId of getActivePlayerIds(state)) {
    const player = state.players.find((candidate: any) => candidate?.id === playerId);
    const voidFleet = state?.gameData?.voidShipsByPlayerId?.[playerId];
    const energy = state?.gameData?.ancient?.energyByPlayerId?.[playerId];
    const ledger = state?.gameData?.ancient?.solarLedgerByPlayerId?.[playerId];

    voidShipsByPlayerId[playerId] = Array.isArray(voidFleet)
      ? structuredClone(voidFleet)
      : [];
    healthByPlayerId[playerId] =
      typeof player?.health === 'number' && Number.isFinite(player.health)
        ? player.health
        : 0;
    ancientEnergyByPlayerId[playerId] = structuredClone(
      isObject(energy)
        ? energy as AncientPlayerEnergyState
        : createEmptyAncientEnergyState(),
    );
    ancientSolarLedgerByPlayerId[playerId] = structuredClone(
      isObject(ledger)
        ? ledger as AncientSolarLedgerState
        : createEmptyAncientSolarLedgerState(),
    );
  }

  turnData.chargeDeclarationVisibilitySnapshot = {
    battleTurnNumber,
    voidShipsByPlayerId,
    healthByPlayerId,
    ancientEnergyByPlayerId,
    ancientSolarLedgerByPlayerId,
  } satisfies ChargeDeclarationVisibilitySnapshot;
  turnData.chargeDeclarationAcknowledgements = {
    battleTurnNumber,
    chargeAfterByPlayerId: {},
  } satisfies ChargeDeclarationAcknowledgements;
}

export function clearChargeDeclarationVisibilityState(state: any): void {
  const turnData = state?.gameData?.turnData;
  if (!isObject(turnData)) return;
  delete turnData.chargeDeclarationVisibilitySnapshot;
  delete turnData.chargeDeclarationAcknowledgements;
}

function getCurrentVisibilitySnapshot(
  state: any,
): ChargeDeclarationVisibilitySnapshot | null {
  const snapshot = state?.gameData?.turnData?.chargeDeclarationVisibilitySnapshot;
  if (
    !isObject(snapshot) ||
    snapshot.battleTurnNumber !== getChargeDeclarationTurnNumber(state) ||
    !isObject(snapshot.voidShipsByPlayerId) ||
    !isObject(snapshot.healthByPlayerId) ||
    !isObject(snapshot.ancientEnergyByPlayerId) ||
    !isObject(snapshot.ancientSolarLedgerByPlayerId)
  ) {
    return null;
  }
  return snapshot as ChargeDeclarationVisibilitySnapshot;
}

function getCurrentAcknowledgements(
  state: any,
): ChargeDeclarationAcknowledgements | null {
  const acknowledgements =
    state?.gameData?.turnData?.chargeDeclarationAcknowledgements;
  if (
    !isObject(acknowledgements) ||
    acknowledgements.battleTurnNumber !== getChargeDeclarationTurnNumber(state) ||
    !isObject(acknowledgements.chargeAfterByPlayerId)
  ) {
    return null;
  }
  return acknowledgements as ChargeDeclarationAcknowledgements;
}

function getCurrentFleetSnapshot(
  state: any,
): Record<string, ShipInstance[]> | null {
  const fleets = state?.gameData?.turnData?.chargeDeclarationFleetSnapshotByPlayerId;
  if (!isObject(fleets)) return null;
  for (const playerId of getActivePlayerIds(state)) {
    if (!Array.isArray(fleets[playerId])) return null;
  }
  return fleets as Record<string, ShipInstance[]>;
}

export function isChargeDeclarationLegalityInvariantError(error: unknown): boolean {
  return error instanceof Error && error.message === CHARGE_DECLARATION_LEGALITY_INVARIANT;
}

export function requireChargeDeclarationLegalityState<T = any>(state: T): T {
  if (!isChargeDeclarationPrivacyActive(state)) return state;

  const visibilitySnapshot = getCurrentVisibilitySnapshot(state);
  const acknowledgements = getCurrentAcknowledgements(state);
  const fleetSnapshot = getCurrentFleetSnapshot(state);
  if (!visibilitySnapshot || !acknowledgements || !fleetSnapshot) {
    throw new Error(CHARGE_DECLARATION_LEGALITY_INVARIANT);
  }

  return {
    ...(state as any),
    gameData: {
      ...(state as any).gameData,
      ships: fleetSnapshot,
    },
  } as T;
}

export function recordChargeDeclarationSpendAcknowledgements(
  state: any,
  playerId: string,
  effectEvents: readonly EffectEvent[],
): void {
  if (!isChargeDeclarationPrivacyActive(state)) return;
  const acknowledgements = getCurrentAcknowledgements(state);
  if (!acknowledgements || !getCurrentVisibilitySnapshot(state) || !getCurrentFleetSnapshot(state)) {
    throw new Error(CHARGE_DECLARATION_LEGALITY_INVARIANT);
  }

  const currentPlayerAcknowledgements = isObject(
    acknowledgements.chargeAfterByPlayerId[playerId],
  )
    ? acknowledgements.chargeAfterByPlayerId[playerId]
    : {};
  let changed = false;

  for (const event of effectEvents) {
    if (event?.type !== 'EFFECT_APPLIED' || event.kind !== 'SpendCharge') continue;
    if (event.targetPlayerId !== playerId) continue;
    const sourceInstanceId = event.details?.shipInstanceId;
    const after = event.details?.after;
    if (
      typeof sourceInstanceId !== 'string' ||
      sourceInstanceId.length === 0 ||
      typeof after !== 'number' ||
      !Number.isFinite(after)
    ) {
      continue;
    }
    currentPlayerAcknowledgements[sourceInstanceId] = Math.max(0, Math.floor(after));
    changed = true;
  }

  if (changed) {
    acknowledgements.chargeAfterByPlayerId[playerId] = currentPlayerAcknowledgements;
  }
}

function projectPlayers(
  players: unknown,
  healthByPlayerId: Record<string, number> | null,
): unknown {
  if (!Array.isArray(players)) return players;
  return players.map((player: any) => {
    if (!isObject(player) || player.role !== 'player' || typeof player.id !== 'string') {
      return player;
    }
    if (!healthByPlayerId || typeof healthByPlayerId[player.id] !== 'number') {
      const {
        health: _redactedHealth,
        maxHealth: _redactedMaxHealth,
        ...safePlayer
      } = player;
      return safePlayer;
    }
    const { maxHealth: _redactedMaxHealth, ...safePlayer } = player;
    return { ...safePlayer, health: healthByPlayerId[player.id] };
  });
}

function projectStablePublicPowerMemory(
  gameData: unknown,
): { frigateTriggerByInstanceId: Record<string, number> } | null {
  const frigateTriggerByInstanceId = isObject(gameData)
    ? gameData.powerMemory?.frigateTriggerByInstanceId
    : null;
  if (!isObject(frigateTriggerByInstanceId)) return null;
  return {
    frigateTriggerByInstanceId: structuredClone(
      frigateTriggerByInstanceId as Record<string, number>,
    ),
  };
}

function applyRequesterChargeAcknowledgements(
  state: any,
  fleets: Record<string, ShipInstance[]>,
  requestingParticipantId: string | undefined,
  acknowledgements: ChargeDeclarationAcknowledgements | null,
): Record<string, ShipInstance[]> {
  const projected = structuredClone(fleets);
  if (!requestingParticipantId || !acknowledgements) return projected;
  const requester = state?.players?.find(
    (player: any) => player?.id === requestingParticipantId,
  );
  if (requester?.role !== 'player') return projected;

  const chargeAfter = acknowledgements.chargeAfterByPlayerId[requestingParticipantId];
  if (!isObject(chargeAfter)) return projected;
  const fleet = projected[requestingParticipantId];
  if (!Array.isArray(fleet)) return projected;

  projected[requestingParticipantId] = fleet.map((ship) =>
    typeof chargeAfter[ship.instanceId] === 'number'
      ? { ...ship, chargesCurrent: chargeAfter[ship.instanceId] }
      : ship
  );
  return projected;
}

export function projectChargeDeclarationStateForViewer<T = any>(
  state: T,
  requestingParticipantId?: string,
): ChargeDeclarationViewerProjection {
  if (!isChargeDeclarationPrivacyActive(state)) {
    return {
      state,
      active: false,
      structuralProjectionAvailable: true,
      acknowledgementsAvailable: true,
    };
  }

  const visibilitySnapshot = getCurrentVisibilitySnapshot(state);
  const fleetSnapshot = getCurrentFleetSnapshot(state);
  const acknowledgements = getCurrentAcknowledgements(state);

  if (!visibilitySnapshot || !fleetSnapshot) {
    const source = state as any;
    const gameData = isObject(source?.gameData) ? source.gameData : {};
    const stablePublicPowerMemory = projectStablePublicPowerMemory(gameData);
    const { pendingTurn: _pendingTurn, powerMemory: _powerMemory, ...safeGameData } = gameData;
    if (stablePublicPowerMemory) {
      safeGameData.powerMemory = stablePublicPowerMemory;
    }
    safeGameData.ships = {};
    safeGameData.voidShipsByPlayerId = {};
    if (Array.isArray(safeGameData.players)) {
      safeGameData.players = projectPlayers(safeGameData.players, null);
    }
    return {
      state: {
        ...source,
        ...(Array.isArray(source?.players)
          ? { players: projectPlayers(source.players, null) }
          : {}),
        gameData: safeGameData,
      },
      active: true,
      structuralProjectionAvailable: false,
      acknowledgementsAvailable: acknowledgements !== null,
      failureReason: visibilitySnapshot
        ? 'fleet_snapshot_missing_or_stale'
        : 'visibility_snapshot_missing_or_stale',
    };
  }

  const source = state as any;
  const gameData = source.gameData;
  const stablePublicPowerMemory = projectStablePublicPowerMemory(gameData);
  const { pendingTurn: _pendingTurn, powerMemory: _powerMemory, ...safeGameData } = gameData;
  if (stablePublicPowerMemory) {
    safeGameData.powerMemory = stablePublicPowerMemory;
  }
  safeGameData.ships = applyRequesterChargeAcknowledgements(
    source,
    fleetSnapshot,
    requestingParticipantId,
    acknowledgements,
  );
  safeGameData.voidShipsByPlayerId = structuredClone(
    visibilitySnapshot.voidShipsByPlayerId,
  );
  if (Array.isArray(safeGameData.players)) {
    safeGameData.players = projectPlayers(
      safeGameData.players,
      visibilitySnapshot.healthByPlayerId,
    );
  }

  return {
    state: {
      ...source,
      ...(Array.isArray(source.players)
        ? {
            players: projectPlayers(
              source.players,
              visibilitySnapshot.healthByPlayerId,
            ),
          }
        : {}),
      gameData: safeGameData,
    },
    active: true,
    structuralProjectionAvailable: true,
    acknowledgementsAvailable: acknowledgements !== null,
    ...(!acknowledgements
      ? { failureReason: 'acknowledgements_missing_or_stale' as const }
      : {}),
  };
}

export function projectChargeDeclarationAncientForViewer(
  state: any,
  requestingParticipantId?: string,
): {
  energyByPlayerId: Record<string, AncientPlayerEnergyState>;
  solarLedgerByPlayerId: Record<string, AncientSolarLedgerState>;
  projectionAvailable: boolean;
} {
  const liveAncient = state?.gameData?.ancient;
  if (!isChargeDeclarationPrivacyActive(state)) {
    return {
      energyByPlayerId: structuredClone(liveAncient?.energyByPlayerId ?? {}),
      solarLedgerByPlayerId: structuredClone(liveAncient?.solarLedgerByPlayerId ?? {}),
      projectionAvailable: true,
    };
  }

  const snapshot = getCurrentVisibilitySnapshot(state);
  const fleetSnapshot = getCurrentFleetSnapshot(state);
  if (!snapshot || !fleetSnapshot) {
    return {
      energyByPlayerId: {},
      solarLedgerByPlayerId: {},
      projectionAvailable: false,
    };
  }

  const energyByPlayerId = structuredClone(snapshot.ancientEnergyByPlayerId);
  const solarLedgerByPlayerId = structuredClone(snapshot.ancientSolarLedgerByPlayerId);
  const requester = state?.players?.find(
    (player: any) => player?.id === requestingParticipantId,
  );
  const accepted = requestingParticipantId
    ? liveAncient?.acceptedDeclarationByPlayerId?.[requestingParticipantId]
    : null;
  const acceptedForCurrentTurn =
    requester?.role === 'player' &&
    accepted?.context?.battleTurnNumber === getChargeDeclarationTurnNumber(state);

  if (acceptedForCurrentTurn && requestingParticipantId) {
    const liveEnergy = liveAncient?.energyByPlayerId?.[requestingParticipantId];
    const liveLedger = liveAncient?.solarLedgerByPlayerId?.[requestingParticipantId];
    if (isObject(liveEnergy)) {
      energyByPlayerId[requestingParticipantId] = structuredClone(
        liveEnergy as AncientPlayerEnergyState,
      );
    }
    if (isObject(liveLedger)) {
      solarLedgerByPlayerId[requestingParticipantId] = structuredClone(
        liveLedger as AncientSolarLedgerState,
      );
    }
  }

  return { energyByPlayerId, solarLedgerByPlayerId, projectionAvailable: true };
}

export function redactChargeDeclarationTurnDataForClient(
  value: unknown,
  declarationActive: boolean,
): Record<string, any> | null {
  if (!isObject(value)) return null;
  const {
    chargeDeclarationVisibilitySnapshot: _visibilitySnapshot,
    chargeDeclarationAcknowledgements: _acknowledgements,
    chargeDeclarationFleetSnapshotByPlayerId: _fleetSnapshot,
    chargeDeclarationEligibleSourceIdsByPlayerId: _eligibleSourceIds,
    acceptedShipOfEqualityTargetsByPlayerId: _acceptedShipOfEqualityTargets,
    ...withoutInternalSnapshots
  } = value;

  if (!declarationActive) return withoutInternalSnapshots;

  const {
    pendingChargeDeclarations: _pendingChargeDeclarations,
    chargeDeclarations: _chargeDeclarations,
    pendingSOLARPowerDeclarations: _pendingSolarDeclarations,
    solarPowerDeclarations: _solarPowerDeclarations,
    anyDeclarationsMade: _anyDeclarationsMade,
    chargePowerUsedByInstanceId: _chargePowerUsed,
    pendingEffects: _pendingEffects,
    shipActivationCueBatches: _activationCues,
    ...safeTurnData
  } = withoutInternalSnapshots;
  return safeTurnData;
}

export function filterChargeDeclarationEventsForViewer(
  state: any,
  requestingParticipantId: string | undefined,
  events: readonly any[],
): any[] {
  if (!isChargeDeclarationPrivacyActive(state)) return [...events];

  return events.filter((event) => {
    const type = event?.type;
    if (typeof type !== 'string') return false;
    if (type.startsWith('BATTLE_LOG_CAPTURE_')) return false;
    if (type === 'EFFECT_APPLIED' || type === 'POWER_USED' || type === 'POWERS_BATCH_SUBMITTED') {
      return false;
    }
    if (type === 'CHARGE_DECLARATION_ACCEPTED') {
      return event?.playerId === requestingParticipantId;
    }
    return true;
  });
}
