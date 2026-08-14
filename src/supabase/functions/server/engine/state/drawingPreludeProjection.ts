import type {
  DrawingPreludePlayerState,
  GameState,
  ShipActivationCueBatch,
  ShipInstance,
} from './GameStateTypes.ts';
import {
  getCarrierDrawingPreludeChoiceLegality,
  getCurrentDrawingPreludePlayerState,
  isDrawingPreludeSourceResolved,
  isStructurallyValidDrawingPreludePlayerState,
  validateFrozenCarrierDrawingPreludeSource,
} from './drawingPreludeState.ts';
import { getShipActivationCueBatches } from './shipActivationCues.ts';

export type DrawingPreludeRequesterSummary = {
  turnNumber: number;
  status: 'awaiting_actions' | 'complete';
  passIndex: 1 | 2;
  passCount: 1 | 2;
};

export type DrawingPreludeCarrierAction = {
  kind: 'choice';
  actionId: 'CAR#0';
  shipDefId: 'CAR';
  sourceInstanceId: string;
  passIndex: 1 | 2;
  choices: Array<{ choiceId: 'defender' | 'fighter' | 'hold' }>;
};

type DrawingPreludeCueKey = {
  turnNumber: number;
  playerId: string;
  passIndex: 1 | 2;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getCanonicalTurnNumber(state: Readonly<any>): number | null {
  const value = state?.gameData?.turnNumber;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function isDrawingPhase(state: Readonly<any>): boolean {
  const gameData = state?.gameData;
  const turnData = gameData?.turnData;
  const major = gameData?.currentPhase ?? turnData?.currentMajorPhase ?? state?.currentPhase;
  const sub = gameData?.currentSubPhase ?? turnData?.currentSubPhase ?? state?.currentSubPhase;
  return major === 'build' && sub === 'drawing';
}

function getParticipantRole(
  state: Readonly<any>,
  participantId?: string,
): 'player' | 'spectator' | null {
  if (!participantId || !Array.isArray(state?.players)) return null;
  const participant = state.players.find((entry: any) => entry?.id === participantId);
  return participant?.role === 'player' || participant?.role === 'spectator'
    ? participant.role
    : null;
}

export function hasCurrentDrawingPreludePrivacyClaim(
  state: Readonly<any>,
): boolean {
  if (!isDrawingPhase(state)) return false;
  const turnNumber = getCanonicalTurnNumber(state);
  const playerMap = state?.gameData?.turnData?.drawingPreludeByPlayerId;
  if (turnNumber === null || !isObject(playerMap)) return false;
  return Object.values(playerMap).some((entry) =>
    isObject(entry) && entry.turnNumber === turnNumber
  );
}

function getValidCurrentSnapshot(
  state: Readonly<any>,
  playerId: string,
): ShipInstance[] | null {
  const turnNumber = getCanonicalTurnNumber(state);
  if (turnNumber === null) return null;
  const playerState = state?.gameData?.turnData?.drawingPreludeByPlayerId?.[playerId];
  if (!isStructurallyValidDrawingPreludePlayerState(playerState, turnNumber)) return null;
  const snapshot = state?.gameData?.turnData?.buildDrawingPublicFleetByPlayerId?.[playerId];
  if (
    !Array.isArray(snapshot) ||
    snapshot.some((ship) =>
      !isObject(ship) ||
      typeof ship.instanceId !== 'string' ||
      ship.instanceId.length === 0 ||
      typeof ship.shipDefId !== 'string' ||
      ship.shipDefId.length === 0
    )
  ) {
    return null;
  }
  return structuredClone(snapshot);
}

export function projectDrawingPreludeFleetsForViewer(
  state: Readonly<any>,
  shipsByPlayerId: unknown,
  requestingParticipantId?: string,
): Record<string, ShipInstance[]> {
  if (!isObject(shipsByPlayerId)) return {};
  if (!hasCurrentDrawingPreludePrivacyClaim(state)) {
    return Object.fromEntries(
      Object.entries(shipsByPlayerId).map(([playerId, fleet]) => [
        playerId,
        Array.isArray(fleet) ? structuredClone(fleet) : [],
      ]),
    );
  }

  const requesterRole = getParticipantRole(state, requestingParticipantId);
  return Object.fromEntries(
    Object.entries(shipsByPlayerId).map(([playerId, fleet]) => {
      if (requesterRole === 'player' && playerId === requestingParticipantId) {
        return [playerId, Array.isArray(fleet) ? structuredClone(fleet) : []];
      }
      return [playerId, getValidCurrentSnapshot(state, playerId) ?? []];
    }),
  );
}

function getUnresolvedCurrentPassSources(playerState: DrawingPreludePlayerState) {
  return playerState.eligibleSourcePowers.filter((source) =>
    !isDrawingPreludeSourceResolved(playerState, source.key, playerState.activePassIndex)
  );
}

export function projectDrawingPreludeCarrierActions(
  state: Readonly<GameState>,
  requestingPlayerId: string,
): DrawingPreludeCarrierAction[] {
  if (
    !hasCurrentDrawingPreludePrivacyClaim(state) ||
    getParticipantRole(state, requestingPlayerId) !== 'player'
  ) {
    return [];
  }

  const playerPrelude = getCurrentDrawingPreludePlayerState(
    state,
    requestingPlayerId,
  );
  if (!playerPrelude || playerPrelude.status !== 'awaiting_actions') return [];
  if (playerPrelude.eligibleSourcePowers.some((source) =>
    source.mode === 'automatic' &&
    !isDrawingPreludeSourceResolved(
      playerPrelude,
      source.key,
      playerPrelude.activePassIndex,
    )
  )) {
    return [];
  }

  const actions: DrawingPreludeCarrierAction[] = [];
  for (const source of playerPrelude.eligibleSourcePowers) {
    if (
      source.mode !== 'interactive' ||
      isDrawingPreludeSourceResolved(
        playerPrelude,
        source.key,
        playerPrelude.activePassIndex,
      )
    ) {
      continue;
    }
    const validated = validateFrozenCarrierDrawingPreludeSource(
      state,
      requestingPlayerId,
      source,
    );
    if (!validated.ok) return [];
    const legality = getCarrierDrawingPreludeChoiceLegality(
      state,
      requestingPlayerId,
      source,
    );
    if (!legality.ok) return [];
    if (legality.value.holdOnly) continue;
    actions.push({
      kind: 'choice',
      actionId: 'CAR#0',
      shipDefId: 'CAR',
      sourceInstanceId: source.sourceInstanceId,
      passIndex: playerPrelude.activePassIndex,
      choices: [
        ...legality.value.nonHoldChoiceIds.map((choiceId) => ({ choiceId })),
        { choiceId: 'hold' },
      ],
    });
  }
  return structuredClone(actions);
}

export function projectDrawingPreludeRequesterSummary(
  state: Readonly<GameState>,
  requestingParticipantId?: string,
): DrawingPreludeRequesterSummary | null {
  if (
    !hasCurrentDrawingPreludePrivacyClaim(state) ||
    getParticipantRole(state, requestingParticipantId) !== 'player' ||
    !requestingParticipantId
  ) {
    return null;
  }

  const turnNumber = getCanonicalTurnNumber(state);
  if (turnNumber === null) return null;
  const playerState = state.gameData.turnData?.drawingPreludeByPlayerId?.[requestingParticipantId];
  if (!isStructurallyValidDrawingPreludePlayerState(playerState, turnNumber)) return null;

  const unresolved = getUnresolvedCurrentPassSources(playerState);
  if (unresolved.some((source) => source.mode === 'automatic')) return null;

  if (playerState.status === 'awaiting_actions') {
    if (unresolved.length === 0 || unresolved.some((source) => source.mode !== 'interactive')) {
      return null;
    }
    for (const source of unresolved) {
      const legality = getCarrierDrawingPreludeChoiceLegality(
        state,
        requestingParticipantId,
        source,
      );
      if (!legality.ok || legality.value.holdOnly) return null;
    }
  } else if (unresolved.length > 0) {
    return null;
  }

  return structuredClone({
    turnNumber: playerState.turnNumber,
    status: playerState.status,
    passIndex: playerState.activePassIndex,
    passCount: playerState.requiredPassCount,
  });
}

function parsePrivateDrawingPreludeCueKey(value: unknown): DrawingPreludeCueKey | null {
  if (typeof value !== 'string') return null;
  const match = /^ship-activation:(\d+):build\.drawing:drawing-prelude:([^:]+):pass:([12])$/.exec(value);
  if (!match) return null;
  const turnNumber = Number(match[1]);
  return {
    turnNumber,
    playerId: match[2],
    passIndex: match[3] === '2' ? 2 : 1,
  };
}

export function createPrivateDrawingPreludeCueKey(args: {
  turnNumber: number;
  playerId: string;
  passIndex: 1 | 2;
}): string {
  return `ship-activation:${args.turnNumber}:build.drawing:drawing-prelude:${args.playerId}:pass:${args.passIndex}`;
}

type PrivateCurrentDrawingCueBatch = {
  playerId: string;
  isWellFormed: boolean;
};

function classifyPrivateCurrentDrawingCueBatch(
  state: Readonly<any>,
  batch: ShipActivationCueBatch,
): PrivateCurrentDrawingCueBatch | null {
  if (!hasCurrentDrawingPreludePrivacyClaim(state)) return null;
  const currentTurn = getCanonicalTurnNumber(state);
  const key = parsePrivateDrawingPreludeCueKey(batch.key);
  if (
    currentTurn === null ||
    key === null ||
    key.turnNumber !== currentTurn ||
    batch.turnNumber !== currentTurn ||
    batch.phaseKey !== 'build.drawing'
  ) {
    return null;
  }
  return {
    playerId: key.playerId,
    isWellFormed: batch.sources.every((source) => source.playerId === key.playerId),
  };
}

export function redactPrivateDrawingPreludeCuesForPublic(
  state: Readonly<any>,
  value: unknown,
): ShipActivationCueBatch[] {
  return getShipActivationCueBatches(value)
    .filter((batch) => classifyPrivateCurrentDrawingCueBatch(state, batch) === null)
    .map((batch) => structuredClone(batch));
}

export function projectPrivateDrawingPreludeCuesForRequester(
  state: Readonly<any>,
  value: unknown,
  requestingParticipantId?: string,
): ShipActivationCueBatch[] {
  if (getParticipantRole(state, requestingParticipantId) !== 'player') return [];
  return getShipActivationCueBatches(value)
    .filter((batch) => {
      const privateBatch = classifyPrivateCurrentDrawingCueBatch(state, batch);
      return privateBatch?.isWellFormed === true &&
        privateBatch.playerId === requestingParticipantId;
    })
    .map((batch) => structuredClone(batch));
}

export function projectDrawingPreludeCuesForIntentState(
  state: Readonly<any>,
  value: unknown,
  requestingParticipantId?: string,
): ShipActivationCueBatch[] {
  const requesterRole = getParticipantRole(state, requestingParticipantId);
  return getShipActivationCueBatches(value)
    .filter((batch) => {
      const privateBatch = classifyPrivateCurrentDrawingCueBatch(state, batch);
      if (!privateBatch) return true;
      return privateBatch.isWellFormed &&
        requesterRole === 'player' &&
        privateBatch.playerId === requestingParticipantId;
    })
    .map((batch) => structuredClone(batch));
}

export function redactDrawingPreludeTurnDataForClient(
  value: unknown,
  state: Readonly<any>,
  requestingParticipantId?: string,
): Record<string, any> | null {
  if (!isObject(value)) return null;
  const {
    drawingPreludeByPlayerId: _drawingPreludeByPlayerId,
    buildDrawingPublicFleetByPlayerId: _buildDrawingPublicFleetByPlayerId,
    ...safeTurnData
  } = value;
  if (Object.prototype.hasOwnProperty.call(safeTurnData, 'shipActivationCueBatches')) {
    safeTurnData.shipActivationCueBatches = projectDrawingPreludeCuesForIntentState(
      state,
      safeTurnData.shipActivationCueBatches,
      requestingParticipantId,
    );
  }
  return safeTurnData;
}

export function filterDrawingPreludeEventsForViewer(
  state: Readonly<any>,
  requestingParticipantId: string | undefined,
  events: readonly any[],
): any[] {
  const requesterRole = getParticipantRole(state, requestingParticipantId);
  const filtered: any[] = [];
  for (const event of events) {
    if (!isObject(event) || !Object.prototype.hasOwnProperty.call(event, 'drawingPreludeVisibility')) {
      if (!isObject(event)) {
        filtered.push(event);
        continue;
      }
      const {
        cubeRollValues: _privateCubeRollValues,
        producedBuildOccurrence: _privateOccurrence,
        sourceShipInstanceId: _privateSourceShipInstanceId,
        ...safeEvent
      } = event;
      filtered.push(structuredClone(safeEvent));
      continue;
    }
    const visibility = event.drawingPreludeVisibility;
    if (
      !isObject(visibility) ||
      visibility.audience !== 'owner' ||
      typeof visibility.playerId !== 'string' ||
      visibility.playerId.length === 0
    ) {
      continue;
    }
    if (
      requesterRole !== 'player' ||
      visibility.playerId !== requestingParticipantId
    ) {
      continue;
    }
    const {
      drawingPreludeVisibility: _privateVisibility,
      cubeRollValues: _privateCubeRollValues,
      producedBuildOccurrence: _privateOccurrence,
      sourceShipInstanceId: _privateSourceShipInstanceId,
      ...safeEvent
    } = event;
    filtered.push(structuredClone(safeEvent));
  }
  return filtered;
}
