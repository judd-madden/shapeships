import {
  getShipDefinition,
} from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import type {
  StructuredChoiceOption,
  StructuredShipPower,
} from '../../engine_shared/effects/translateShipPowers.ts';
import {
  getDirectMaterializedSimulacrumInstanceIdsForPlayer,
} from '../ancient/simulacrumSolarPower.ts';
import type {
  DrawingPreludePassIndex,
  DrawingPreludePlayerState,
  DrawingPreludeSourcePower,
  GameState,
  ShipInstance,
} from './GameStateTypes.ts';

export type DrawingPreludeWorkingPlayerState = Omit<
  DrawingPreludePlayerState,
  'status'
>;

export type DrawingPreludeInitializationCandidate = {
  turnNumber: number;
  playerStateByPlayerId: Record<string, DrawingPreludeWorkingPlayerState>;
  buildDrawingPublicFleetByPlayerId: Record<string, ShipInstance[]>;
};

export type DrawingPreludeFoundationError = {
  code:
    | 'INVALID_CANONICAL_TURN'
    | 'INVALID_PLAYER_ID'
    | 'UNKNOWN_SHIP_DEFINITION'
    | 'UNCLASSIFIED_START_OF_DRAWING_POWER'
    | 'INVALID_CANDIDATE'
    | 'INVALID_SOURCE_KEY'
    | 'INVALID_SOURCE_MODE'
    | 'INVALID_CARRIER_COORDINATE'
    | 'INVALID_CARRIER_SOURCE'
    | 'INVALID_CARRIER_OVERLAY'
    | 'AUTOMATIC_SOURCES_UNRESOLVED';
  message: string;
};

export type DrawingPreludeFoundationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DrawingPreludeFoundationError };

export type CarrierDrawingPreludeChoiceId = 'defender' | 'fighter';

export type CarrierDrawingPreludeChoiceLegality = {
  nonHoldChoiceIds: CarrierDrawingPreludeChoiceId[];
  holdOnly: boolean;
};

export type ValidatedCarrierDrawingPreludeSource = {
  liveSource: ShipInstance;
  choicePower: Extract<StructuredShipPower, { type: 'choice' }>;
};

const MODE_BY_RAW_COORDINATE: Readonly<
  Record<string, DrawingPreludeSourcePower['mode']>
> = {
  'CAR#0': 'interactive',
  'BUG#0': 'automatic',
  'ZEN#1': 'automatic',
  'QUE#0': 'automatic',
};

export function classifyDrawingPreludeSourceMode(
  coordinate: string,
): DrawingPreludeFoundationResult<DrawingPreludeSourcePower['mode']> {
  const mode = MODE_BY_RAW_COORDINATE[coordinate];
  return mode
    ? { ok: true, value: mode }
    : failure(
        'UNCLASSIFIED_START_OF_DRAWING_POWER',
        `Start-of-Drawing power has no execution mode classification: ${coordinate}`,
      );
}

function failure<T>(
  code: DrawingPreludeFoundationError['code'],
  message: string,
): DrawingPreludeFoundationResult<T> {
  return { ok: false, error: { code, message } };
}

function getCanonicalTurnNumber(state: Readonly<GameState>): number | null {
  const turnNumber = state?.gameData?.turnNumber;
  return Number.isInteger(turnNumber) && turnNumber >= 0 ? turnNumber : null;
}

function getActivePlayerIds(state: Readonly<GameState>): string[] | null {
  const ids: string[] = [];
  for (const player of state.players ?? []) {
    if (player.role !== 'player') continue;
    if (typeof player.id !== 'string' || player.id.length === 0) return null;
    ids.push(player.id);
  }
  return ids;
}

function sourceIsEligible(args: {
  source: Readonly<ShipInstance>;
  coordinate: string;
  currentTurn: number;
  directMaterializedIds: ReadonlySet<string>;
}): boolean {
  const { source, coordinate, currentTurn, directMaterializedIds } = args;
  if (coordinate === 'CAR#0') return true;
  if (coordinate === 'BUG#0' || coordinate === 'ZEN#1') {
    return (source.createdTurn ?? 0) < currentTurn ||
      directMaterializedIds.has(source.instanceId);
  }
  if (coordinate === 'QUE#0') {
    return (source.createdTurn ?? 0) < currentTurn;
  }
  return false;
}

export function createDrawingPreludeInitializationCandidate(
  state: Readonly<GameState>,
): DrawingPreludeFoundationResult<DrawingPreludeInitializationCandidate> {
  const turnNumber = getCanonicalTurnNumber(state);
  if (turnNumber === null) {
    return failure('INVALID_CANONICAL_TURN', 'Drawing prelude requires a canonical integer turn number');
  }

  const activePlayerIds = getActivePlayerIds(state);
  if (!activePlayerIds) {
    return failure('INVALID_PLAYER_ID', 'Drawing prelude requires non-empty active player IDs');
  }

  const playerStateByPlayerId: Record<string, DrawingPreludeWorkingPlayerState> = {};
  const buildDrawingPublicFleetByPlayerId: Record<string, ShipInstance[]> = {};

  for (const playerId of activePlayerIds) {
    const fleet = Array.isArray(state.gameData.ships?.[playerId])
      ? state.gameData.ships![playerId]
      : [];
    buildDrawingPublicFleetByPlayerId[playerId] = structuredClone(fleet);

    const directMaterializedIds =
      getDirectMaterializedSimulacrumInstanceIdsForPlayer(state, playerId);
    const eligibleSourcePowers: DrawingPreludeSourcePower[] = [];
    const seenKeys = new Set<string>();

    for (const source of fleet) {
      const definition = getShipDefinition(source.shipDefId);
      if (!definition) {
        return failure(
          'UNKNOWN_SHIP_DEFINITION',
          `Unknown Drawing-prelude source definition: ${source.shipDefId}`,
        );
      }

      for (let rawPowerIndex = 0; rawPowerIndex < definition.powers.length; rawPowerIndex += 1) {
        const power = definition.powers[rawPowerIndex];
        if (power.activationTiming !== 'start_of_drawing') continue;

        const coordinate = `${source.shipDefId}#${rawPowerIndex}`;
        const classifiedMode = classifyDrawingPreludeSourceMode(coordinate);
        if (!classifiedMode.ok) return classifiedMode;
        const mode = classifiedMode.value;
        if (!sourceIsEligible({
          source,
          coordinate,
          currentTurn: turnNumber,
          directMaterializedIds,
        })) {
          continue;
        }

        const key = `${source.instanceId}:${coordinate}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        eligibleSourcePowers.push({
          key,
          sourceInstanceId: source.instanceId,
          shipDefId: source.shipDefId,
          rawPowerIndex,
          mode,
        });
      }
    }

    const chronoswarmCount =
      state.gameData.turnData?.chronoswarmCountByPlayerId?.[playerId];
    playerStateByPlayerId[playerId] = {
      turnNumber,
      requiredPassCount:
        Number.isInteger(chronoswarmCount) && (chronoswarmCount as number) > 0
          ? 2
          : 1,
      activePassIndex: 1,
      eligibleSourcePowers,
      resolvedSourcePowerKeysByPass: {},
    };
  }

  return {
    ok: true,
    value: {
      turnNumber,
      playerStateByPlayerId,
      buildDrawingPublicFleetByPlayerId,
    },
  };
}

function getOrderedResolvedKeys(
  playerState: Readonly<DrawingPreludeWorkingPlayerState>,
  passIndex: DrawingPreludePassIndex,
  additionalKey?: string,
): string[] {
  const resolved = new Set(playerState.resolvedSourcePowerKeysByPass[passIndex] ?? []);
  if (additionalKey) resolved.add(additionalKey);
  return playerState.eligibleSourcePowers
    .map((source) => source.key)
    .filter((key) => resolved.has(key));
}

export function isDrawingPreludeSourceResolved(
  playerState: Readonly<DrawingPreludeWorkingPlayerState>,
  sourceKey: string,
  passIndex: DrawingPreludePassIndex = playerState.activePassIndex,
): boolean {
  return playerState.resolvedSourcePowerKeysByPass[passIndex]?.includes(sourceKey) === true;
}

export function markDrawingPreludeCandidateSourceResolved(
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
  playerId: string,
  sourceKey: string,
): DrawingPreludeFoundationResult<DrawingPreludeInitializationCandidate> {
  const playerState = candidate.playerStateByPlayerId[playerId];
  if (!playerState || playerState.turnNumber !== candidate.turnNumber) {
    return failure('INVALID_CANDIDATE', `No current Drawing-prelude candidate for player ${playerId}`);
  }
  if (!playerState.eligibleSourcePowers.some((source) => source.key === sourceKey)) {
    return failure('INVALID_SOURCE_KEY', `Source key is not frozen for player ${playerId}: ${sourceKey}`);
  }
  if (isDrawingPreludeSourceResolved(playerState, sourceKey)) {
    return { ok: true, value: candidate as DrawingPreludeInitializationCandidate };
  }

  const next = structuredClone(candidate) as DrawingPreludeInitializationCandidate;
  const nextPlayerState = next.playerStateByPlayerId[playerId];
  nextPlayerState.resolvedSourcePowerKeysByPass[nextPlayerState.activePassIndex] =
    getOrderedResolvedKeys(playerState, playerState.activePassIndex, sourceKey);
  return { ok: true, value: next };
}

export function markCurrentDrawingPreludeSourceResolved(
  state: Readonly<GameState>,
  playerId: string,
  sourceKey: string,
): DrawingPreludeFoundationResult<GameState> {
  const playerState = getCurrentDrawingPreludePlayerState(state, playerId);
  if (!playerState) {
    return failure('INVALID_CANDIDATE', `No valid current Drawing-prelude state for player ${playerId}`);
  }
  if (!playerState.eligibleSourcePowers.some((source) => source.key === sourceKey)) {
    return failure('INVALID_SOURCE_KEY', `Source key is not frozen for player ${playerId}: ${sourceKey}`);
  }
  if (isDrawingPreludeSourceResolved(playerState, sourceKey)) {
    return { ok: true, value: state as GameState };
  }

  const next = structuredClone(state) as GameState;
  const nextPlayerState = next.gameData.turnData!.drawingPreludeByPlayerId![playerId];
  nextPlayerState.resolvedSourcePowerKeysByPass[nextPlayerState.activePassIndex] =
    getOrderedResolvedKeys(playerState, playerState.activePassIndex, sourceKey);
  return { ok: true, value: next };
}

export function recordDrawingPreludeAutomaticEvaluation(
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
  playerId: string,
  sourceKey: string,
): DrawingPreludeFoundationResult<DrawingPreludeInitializationCandidate> {
  const source = candidate.playerStateByPlayerId[playerId]?.eligibleSourcePowers
    .find((entry) => entry.key === sourceKey);
  if (!source) {
    return failure('INVALID_SOURCE_KEY', `Automatic source key is not frozen for player ${playerId}: ${sourceKey}`);
  }
  if (source.mode !== 'automatic') {
    return failure('INVALID_SOURCE_MODE', `Drawing-prelude source is not automatic: ${sourceKey}`);
  }
  return markDrawingPreludeCandidateSourceResolved(candidate, playerId, sourceKey);
}

function findControlledSource(
  state: Readonly<GameState>,
  playerId: string,
  sourceInstanceId: string,
): ShipInstance | null {
  const fleet = state.gameData.ships?.[playerId];
  if (!Array.isArray(fleet)) return null;
  return fleet.find((ship) => ship.instanceId === sourceInstanceId) ?? null;
}

function optionHasExactCarrierShape(
  option: StructuredChoiceOption | undefined,
  choiceId: 'defender' | 'fighter' | 'hold',
): boolean {
  if (!option || option.choiceId !== choiceId) return false;
  if (choiceId === 'hold') {
    return option.effects.length === 0 &&
      (option.requiresCharge ?? false) === false &&
      (option.chargeCost ?? 0) === 0;
  }

  const chargeCost = choiceId === 'defender' ? 1 : 2;
  const createdShipDefId = choiceId === 'defender' ? 'DEF' : 'FIG';
  const [spend, create] = option.effects;
  return option.effects.length === 2 &&
    option.requiresCharge === true &&
    option.chargeCost === chargeCost &&
    spend?.type === 'effect' &&
    spend.kind === EffectKind.SpendCharge &&
    spend.amount === chargeCost &&
    spend.targetPlayer === 'self' &&
    create?.type === 'effect' &&
    create.kind === EffectKind.CreateShip &&
    create.shipDefId === createdShipDefId &&
    create.targetPlayer === 'self';
}

export function validateFrozenCarrierDrawingPreludeSource(
  state: Readonly<GameState>,
  playerId: string,
  source: Readonly<DrawingPreludeSourcePower>,
): DrawingPreludeFoundationResult<ValidatedCarrierDrawingPreludeSource> {
  if (
    source.shipDefId !== 'CAR' ||
    source.rawPowerIndex !== 0 ||
    source.mode !== 'interactive' ||
    source.key !== `${source.sourceInstanceId}:CAR#0`
  ) {
    return failure('INVALID_CARRIER_COORDINATE', 'Carrier resolution requires the exact frozen CAR#0 coordinate');
  }

  const liveSource = findControlledSource(state, playerId, source.sourceInstanceId);
  if (!liveSource) {
    return failure('INVALID_CARRIER_SOURCE', `Frozen Carrier source is not controlled by player ${playerId}`);
  }
  if (liveSource.shipDefId !== source.shipDefId) {
    return failure('INVALID_CARRIER_SOURCE', `Frozen Carrier definition no longer matches live source ${source.sourceInstanceId}`);
  }

  const definition = getShipDefinition(source.shipDefId);
  const rawPower = definition?.powers[source.rawPowerIndex];
  if (!rawPower || rawPower.activationTiming !== 'start_of_drawing') {
    return failure('INVALID_CARRIER_COORDINATE', 'CAR#0 must remain a start-of-drawing raw power');
  }
  const overlays = rawPower.structuredPowers;
  if (!Array.isArray(overlays) || overlays.length !== 1 || overlays[0].type !== 'choice') {
    return failure('INVALID_CARRIER_OVERLAY', 'CAR#0 must contain exactly one raw-coordinate choice overlay');
  }
  const choicePower = overlays[0];
  const optionIds = choicePower.options.map((option) => option.choiceId);
  if (
    optionIds.length !== 3 ||
    new Set(optionIds).size !== 3 ||
    !optionHasExactCarrierShape(choicePower.options.find((option) => option.choiceId === 'defender'), 'defender') ||
    !optionHasExactCarrierShape(choicePower.options.find((option) => option.choiceId === 'fighter'), 'fighter') ||
    !optionHasExactCarrierShape(choicePower.options.find((option) => option.choiceId === 'hold'), 'hold')
  ) {
    return failure('INVALID_CARRIER_OVERLAY', 'CAR#0 defender, fighter, and Hold overlay shape changed');
  }
  return {
    ok: true,
    value: { liveSource: structuredClone(liveSource), choicePower },
  };
}

export function getCarrierDrawingPreludeChoiceLegality(
  state: Readonly<GameState>,
  playerId: string,
  source: Readonly<DrawingPreludeSourcePower>,
): DrawingPreludeFoundationResult<CarrierDrawingPreludeChoiceLegality> {
  if (
    source.shipDefId !== 'CAR' ||
    source.rawPowerIndex !== 0 ||
    source.mode !== 'interactive'
  ) {
    return failure('INVALID_CARRIER_COORDINATE', 'Carrier legality requires the frozen CAR#0 coordinate');
  }

  const validated = validateFrozenCarrierDrawingPreludeSource(state, playerId, source);
  if (!validated.ok) return validated;
  const { choicePower, liveSource: controlledSource } = validated.value;
  const optionIds = choicePower.options.map((option) => option.choiceId);
  if (
    optionIds.length !== 3 ||
    new Set(optionIds).size !== 3 ||
    !optionIds.includes('defender') ||
    !optionIds.includes('fighter') ||
    !optionIds.includes('hold')
  ) {
    return failure('INVALID_CARRIER_OVERLAY', 'CAR#0 choice overlay must contain defender, fighter, and hold exactly once');
  }

  const chargesCurrent = Number(controlledSource?.chargesCurrent ?? 0);
  if (!Number.isFinite(chargesCurrent) || chargesCurrent < 0) {
    return failure('INVALID_CARRIER_SOURCE', `Frozen Carrier source has invalid current charges: ${source.sourceInstanceId}`);
  }
  const nonHoldChoiceIds: CarrierDrawingPreludeChoiceId[] = [];
  for (const choiceId of ['defender', 'fighter'] as const) {
    const option = choicePower.options.find((candidate) => candidate.choiceId === choiceId)!;
    const requiresCharge = option.requiresCharge;
    const chargeCost = option.chargeCost;
    if (
      typeof requiresCharge !== 'boolean' ||
      !Number.isFinite(chargeCost) ||
      (chargeCost as number) < 0
    ) {
      return failure('INVALID_CARRIER_OVERLAY', `CAR#0 ${choiceId} must declare an option-level charge requirement and cost`);
    }
    if (!requiresCharge || chargesCurrent >= (chargeCost as number)) {
      nonHoldChoiceIds.push(choiceId);
    }
  }

  return {
    ok: true,
    value: {
      nonHoldChoiceIds,
      holdOnly: nonHoldChoiceIds.length === 0,
    },
  };
}

export function recordForcedCarrierHold(
  state: Readonly<GameState>,
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
  playerId: string,
  sourceKey: string,
): DrawingPreludeFoundationResult<DrawingPreludeInitializationCandidate> {
  const playerState = candidate.playerStateByPlayerId[playerId];
  const source = playerState?.eligibleSourcePowers.find((entry) => entry.key === sourceKey);
  if (!source) {
    return failure('INVALID_SOURCE_KEY', `Carrier source key is not frozen for player ${playerId}: ${sourceKey}`);
  }
  const legality = getCarrierDrawingPreludeChoiceLegality(state, playerId, source);
  if (!legality.ok) return legality;
  if (!legality.value.holdOnly) {
    return { ok: true, value: candidate as DrawingPreludeInitializationCandidate };
  }
  return markDrawingPreludeCandidateSourceResolved(candidate, playerId, sourceKey);
}

function allSourcesResolved(
  playerState: Readonly<DrawingPreludeWorkingPlayerState>,
  passIndex: DrawingPreludePassIndex,
): boolean {
  return playerState.eligibleSourcePowers.every((source) =>
    isDrawingPreludeSourceResolved(playerState, source.key, passIndex)
  );
}

export function advanceDrawingPreludeCandidatePlayer(
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
  playerId: string,
): DrawingPreludeFoundationResult<DrawingPreludeInitializationCandidate> {
  const playerState = candidate.playerStateByPlayerId[playerId];
  if (!playerState) {
    return failure('INVALID_CANDIDATE', `No Drawing-prelude candidate for player ${playerId}`);
  }
  if (!allSourcesResolved(playerState, playerState.activePassIndex)) {
    return { ok: true, value: candidate as DrawingPreludeInitializationCandidate };
  }
  if (playerState.activePassIndex !== 1 || playerState.requiredPassCount !== 2) {
    return { ok: true, value: candidate as DrawingPreludeInitializationCandidate };
  }

  const next = structuredClone(candidate) as DrawingPreludeInitializationCandidate;
  next.playerStateByPlayerId[playerId].activePassIndex = 2;
  return { ok: true, value: next };
}

function getUnresolvedSources(
  playerState: Readonly<DrawingPreludeWorkingPlayerState>,
): DrawingPreludeSourcePower[] {
  return playerState.eligibleSourcePowers.filter((source) =>
    !isDrawingPreludeSourceResolved(playerState, source.key)
  );
}

function finalizePlayerCandidate(
  state: Readonly<GameState>,
  candidate: DrawingPreludeInitializationCandidate,
  playerId: string,
): DrawingPreludeFoundationResult<{
  candidate: DrawingPreludeInitializationCandidate;
  playerState: DrawingPreludePlayerState;
}> {
  let workingCandidate = candidate;

  while (true) {
    let playerState = workingCandidate.playerStateByPlayerId[playerId];
    if (!playerState) {
      return failure('INVALID_CANDIDATE', `No Drawing-prelude candidate for player ${playerId}`);
    }

    const unresolvedAutomatic = getUnresolvedSources(playerState)
      .filter((source) => source.mode === 'automatic');
    if (unresolvedAutomatic.length > 0) {
      return failure(
        'AUTOMATIC_SOURCES_UNRESOLVED',
        `Automatic Drawing-prelude sources remain unresolved for player ${playerId}`,
      );
    }

    for (const source of getUnresolvedSources(playerState).filter((entry) => entry.mode === 'interactive')) {
      const forced = recordForcedCarrierHold(state, workingCandidate, playerId, source.key);
      if (!forced.ok) return forced;
      workingCandidate = forced.value;
    }

    playerState = workingCandidate.playerStateByPlayerId[playerId];
    const unresolvedInteractive = getUnresolvedSources(playerState)
      .filter((source) => source.mode === 'interactive');
    if (unresolvedInteractive.length > 0) {
      return {
        ok: true,
        value: {
          candidate: workingCandidate,
          playerState: { ...structuredClone(playerState), status: 'awaiting_actions' },
        },
      };
    }

    if (playerState.activePassIndex === 1 && playerState.requiredPassCount === 2) {
      const advanced = advanceDrawingPreludeCandidatePlayer(workingCandidate, playerId);
      if (!advanced.ok) return advanced;
      workingCandidate = advanced.value;
      continue;
    }

    return {
      ok: true,
      value: {
        candidate: workingCandidate,
        playerState: { ...structuredClone(playerState), status: 'complete' },
      },
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactPlayerIds(
  value: Record<string, unknown>,
  activePlayerIds: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return keys.length === activePlayerIds.length &&
    activePlayerIds.every((playerId) => Object.prototype.hasOwnProperty.call(value, playerId));
}

function isStructurallyValidDrawingPreludeSnapshot(value: unknown): value is ShipInstance[] {
  return Array.isArray(value) && value.every((ship) =>
    isRecord(ship) &&
    typeof ship.instanceId === 'string' &&
    ship.instanceId.length > 0 &&
    typeof ship.shipDefId === 'string' &&
    ship.shipDefId.length > 0
  );
}

function validateCompleteDrawingPreludeCandidate(
  state: Readonly<GameState>,
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
): DrawingPreludeFoundationResult<true> {
  const canonicalTurn = getCanonicalTurnNumber(state);
  const activePlayerIds = getActivePlayerIds(state);
  if (
    canonicalTurn === null ||
    !candidate ||
    typeof candidate !== 'object' ||
    candidate.turnNumber !== canonicalTurn ||
    !activePlayerIds ||
    !isRecord(candidate.playerStateByPlayerId) ||
    !isRecord(candidate.buildDrawingPublicFleetByPlayerId) ||
    !hasExactPlayerIds(candidate.playerStateByPlayerId, activePlayerIds) ||
    !hasExactPlayerIds(candidate.buildDrawingPublicFleetByPlayerId, activePlayerIds)
  ) {
    return failure(
      'INVALID_CANDIDATE',
      'Drawing-prelude candidate does not exactly match the canonical active-player set',
    );
  }

  for (const playerId of activePlayerIds) {
    const playerState = candidate.playerStateByPlayerId[playerId];
    if (
      !playerState ||
      Object.prototype.hasOwnProperty.call(playerState, 'status') ||
      playerState.turnNumber !== candidate.turnNumber ||
      !isStructurallyValidDrawingPreludePlayerState(
        { ...playerState, status: 'awaiting_actions' },
        canonicalTurn,
      ) ||
      !isStructurallyValidDrawingPreludeSnapshot(
        candidate.buildDrawingPublicFleetByPlayerId[playerId],
      )
    ) {
      return failure(
        'INVALID_CANDIDATE',
        `Drawing-prelude candidate contains malformed state for player ${playerId}`,
      );
    }
  }

  return { ok: true, value: true };
}

export function finalizeDrawingPreludeInitializationCandidate(
  state: Readonly<GameState>,
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
): DrawingPreludeFoundationResult<GameState> {
  const candidateValidation = validateCompleteDrawingPreludeCandidate(state, candidate);
  if (!candidateValidation.ok) return candidateValidation;

  let workingCandidate = structuredClone(candidate) as DrawingPreludeInitializationCandidate;
  const drawingPreludeByPlayerId: Record<string, DrawingPreludePlayerState> = {};
  for (const playerId of Object.keys(workingCandidate.playerStateByPlayerId)) {
    const finalized = finalizePlayerCandidate(state, workingCandidate, playerId);
    if (!finalized.ok) return finalized;
    workingCandidate = finalized.value.candidate;
    drawingPreludeByPlayerId[playerId] = finalized.value.playerState;
  }

  const turnData = state.gameData.turnData ?? {};
  return {
    ok: true,
    value: {
      ...structuredClone(state),
      gameData: {
        ...structuredClone(state.gameData),
        turnData: {
          ...structuredClone(turnData),
          drawingPreludeByPlayerId,
          buildDrawingPublicFleetByPlayerId: structuredClone(
            workingCandidate.buildDrawingPublicFleetByPlayerId,
          ),
        },
      },
    },
  };
}

export function isStructurallyValidDrawingPreludePlayerState(
  value: unknown,
  currentTurn: number,
): value is DrawingPreludePlayerState {
  if (!value || typeof value !== 'object') return false;
  const state = value as DrawingPreludePlayerState;
  if (
    state.turnNumber !== currentTurn ||
    (state.requiredPassCount !== 1 && state.requiredPassCount !== 2) ||
    (state.activePassIndex !== 1 && state.activePassIndex !== 2) ||
    (state.status !== 'awaiting_actions' && state.status !== 'complete') ||
    !Array.isArray(state.eligibleSourcePowers) ||
    !state.resolvedSourcePowerKeysByPass ||
    typeof state.resolvedSourcePowerKeysByPass !== 'object'
  ) {
    return false;
  }
  if (state.activePassIndex > state.requiredPassCount) return false;

  const keys = new Set<string>();
  for (const source of state.eligibleSourcePowers) {
    const coordinate = `${source?.shipDefId}#${source?.rawPowerIndex}`;
    const classifiedMode = classifyDrawingPreludeSourceMode(coordinate);
    if (
      !source ||
      typeof source.sourceInstanceId !== 'string' ||
      source.sourceInstanceId.length === 0 ||
      typeof source.shipDefId !== 'string' ||
      source.shipDefId.length === 0 ||
      !Number.isInteger(source.rawPowerIndex) ||
      source.rawPowerIndex < 0 ||
      typeof source.key !== 'string' ||
      source.key !== `${source.sourceInstanceId}:${source.shipDefId}#${source.rawPowerIndex}` ||
      !classifiedMode.ok ||
      classifiedMode.value !== source.mode ||
      keys.has(source.key)
    ) {
      return false;
    }
    keys.add(source.key);
  }

  for (const passIndex of [1, 2] as const) {
    const resolved = state.resolvedSourcePowerKeysByPass[passIndex];
    if (typeof resolved === 'undefined') continue;
    if (passIndex > state.requiredPassCount || passIndex > state.activePassIndex) return false;
    if (!Array.isArray(resolved) || new Set(resolved).size !== resolved.length) return false;
    const ordered = state.eligibleSourcePowers
      .map((source) => source.key)
      .filter((key) => resolved.includes(key));
    if (resolved.some((key) => !keys.has(key)) || JSON.stringify(ordered) !== JSON.stringify(resolved)) {
      return false;
    }
  }
  if (state.activePassIndex === 2 && !allSourcesResolved(state, 1)) return false;
  if (state.status === 'complete') {
    if (state.activePassIndex !== state.requiredPassCount) return false;
    for (let pass = 1; pass <= state.requiredPassCount; pass += 1) {
      if (!allSourcesResolved(state, pass as DrawingPreludePassIndex)) return false;
    }
  }
  return true;
}

export function getCurrentDrawingPreludePlayerState(
  state: Readonly<GameState>,
  playerId: string,
): DrawingPreludePlayerState | null {
  const turnNumber = getCanonicalTurnNumber(state);
  if (turnNumber === null) return null;
  const playerState = state.gameData.turnData?.drawingPreludeByPlayerId?.[playerId];
  return isStructurallyValidDrawingPreludePlayerState(playerState, turnNumber)
    ? structuredClone(playerState)
    : null;
}

export function getCurrentDrawingPreludeCandidatePlayerState(
  state: Readonly<GameState>,
  candidate: Readonly<DrawingPreludeInitializationCandidate>,
  playerId: string,
): DrawingPreludeFoundationResult<DrawingPreludeWorkingPlayerState> {
  const turnNumber = getCanonicalTurnNumber(state);
  const playerState = candidate.playerStateByPlayerId[playerId];
  if (
    turnNumber === null ||
    candidate.turnNumber !== turnNumber ||
    !playerState ||
    playerState.turnNumber !== turnNumber ||
    !isStructurallyValidDrawingPreludePlayerState(
      { ...playerState, status: 'awaiting_actions' },
      turnNumber,
    )
  ) {
    return failure('INVALID_CANDIDATE', `No valid current-turn Drawing-prelude candidate for player ${playerId}`);
  }
  return { ok: true, value: structuredClone(playerState) };
}
