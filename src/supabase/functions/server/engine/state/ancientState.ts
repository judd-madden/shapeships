import type {
  AncientAcceptedDeclaration,
  AncientEnergyPool,
  AncientEnergySource,
  AncientPendingBlackHoleDestruction,
  AncientPendingSimulacrumCopy,
  AncientPlayerEnergyState,
  AncientSolarLedgerEntry,
  AncientSolarLedgerState,
  AncientState,
} from './GameStateTypes.ts';

export const ANCIENT_STATE_SCHEMA_VERSION = 1 as const;

export type AncientCompatibilityRisk = {
  code:
    | 'malformed_canonical_record'
    | 'duplicate_stable_id'
    | 'missing_ancient_schema_version'
    | 'invalid_ancient_schema_version'
    | 'unsupported_ancient_schema_version';
  path: string;
  stableId?: string;
  actualVersion?: number;
};

export type AncientNormalizationResult<T = any> = {
  state: T;
  changed: boolean;
  compatibilityRisks: AncientCompatibilityRisk[];
};

type NormalizedEntry<T> = {
  value: T;
  stableId: string;
  order: number;
  fingerprint: string;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function normalizeAncientNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function normalizeBattleTurnNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return normalizeAncientNumber(value);
}

export function createEmptyAncientEnergyPool(): AncientEnergyPool {
  return { green: 0, red: 0, blue: 0 };
}

function normalizeEnergyPool(value: unknown): AncientEnergyPool {
  const source = isObject(value) ? value : {};
  return {
    green: normalizeAncientNumber(source.green),
    red: normalizeAncientNumber(source.red),
    blue: normalizeAncientNumber(source.blue),
  };
}

export function createEmptyAncientPlayerEnergyState(): AncientPlayerEnergyState {
  return {
    battleTurnNumber: null,
    pool: createEmptyAncientEnergyPool(),
    sources: [],
  };
}

export function createEmptyAncientSolarLedgerState(): AncientSolarLedgerState {
  return {
    battleTurnNumber: null,
    entries: [],
  };
}

function getPlayerSeatIds(players: unknown): string[] {
  if (!Array.isArray(players)) return [];
  return [...new Set(players
    .filter((player: any) => player?.role === 'player' && isNonEmptyString(player?.id))
    .map((player: any) => player.id as string))]
    .sort((a, b) => a.localeCompare(b));
}

export function createEmptyAncientState(players: unknown): AncientState {
  const energyByPlayerId: Record<string, AncientPlayerEnergyState> = {};
  const solarLedgerByPlayerId: Record<string, AncientSolarLedgerState> = {};

  for (const playerId of getPlayerSeatIds(players)) {
    energyByPlayerId[playerId] = createEmptyAncientPlayerEnergyState();
    solarLedgerByPlayerId[playerId] = createEmptyAncientSolarLedgerState();
  }

  return {
    schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
    energyByPlayerId,
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId,
    pendingSimulacrumCopies: [],
    pendingBlackHoleDestructions: [],
  };
}

function pushMalformedRisk(
  risks: AncientCompatibilityRisk[],
  path: string,
): void {
  risks.push({ code: 'malformed_canonical_record', path });
}

function normalizeUniqueEntries<T>(args: {
  raw: unknown;
  path: string;
  risks: AncientCompatibilityRisk[];
  normalize: (value: unknown, index: number) => { value: T; stableId: string; order?: number } | null;
}): T[] {
  const { raw, path, risks, normalize } = args;
  if (!Array.isArray(raw)) {
    if (typeof raw !== 'undefined') pushMalformedRisk(risks, path);
    return [];
  }

  const normalized: NormalizedEntry<T>[] = [];
  raw.forEach((candidate, index) => {
    const result = normalize(candidate, index);
    if (!result) {
      pushMalformedRisk(risks, `${path}[${index}]`);
      return;
    }
    normalized.push({
      value: result.value,
      stableId: result.stableId,
      order: result.order ?? 0,
      fingerprint: JSON.stringify(result.value),
    });
  });

  // Duplicate winner: lowest normalized order, then lexicographically smallest
  // normalized record fingerprint. This stays deterministic regardless of input order.
  normalized.sort((a, b) =>
    a.order - b.order ||
    a.stableId.localeCompare(b.stableId) ||
    a.fingerprint.localeCompare(b.fingerprint)
  );

  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of normalized) {
    if (seen.has(entry.stableId)) {
      risks.push({
        code: 'duplicate_stable_id',
        path,
        stableId: entry.stableId,
      });
      continue;
    }
    seen.add(entry.stableId);
    result.push(entry.value);
  }
  return result;
}

function normalizeEnergySource(value: unknown): AncientEnergySource | null {
  if (!isObject(value) || !isNonEmptyString(value.sourceId) || !isNonEmptyString(value.sourceShipDefId)) {
    return null;
  }
  return {
    sourceId: value.sourceId,
    ...(isNonEmptyString(value.sourceInstanceId) ? { sourceInstanceId: value.sourceInstanceId } : {}),
    sourceShipDefId: value.sourceShipDefId,
    battleTurnNumber: normalizeBattleTurnNumber(value.battleTurnNumber),
    order: normalizeAncientNumber(value.order),
    amounts: normalizeEnergyPool(value.amounts),
  };
}

function normalizePlayerEnergyState(
  value: unknown,
  path: string,
  risks: AncientCompatibilityRisk[],
): AncientPlayerEnergyState {
  const source = isObject(value) ? value : {};
  if (!isObject(value) && typeof value !== 'undefined') pushMalformedRisk(risks, path);
  const sources = normalizeUniqueEntries({
    raw: source.sources,
    path: `${path}.sources`,
    risks,
    normalize(candidate) {
      const normalized = normalizeEnergySource(candidate);
      return normalized
        ? { value: normalized, stableId: normalized.sourceId, order: normalized.order }
        : null;
    },
  });
  return {
    battleTurnNumber: normalizeBattleTurnNumber(source.battleTurnNumber),
    pool: normalizeEnergyPool(source.pool),
    sources,
  };
}

function normalizeTargetReferences(value: unknown): Array<{ playerId: string; shipInstanceId?: string }> | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!Array.isArray(value)) return undefined;
  const targets = value
    .filter((target) => isObject(target) && isNonEmptyString(target.playerId))
    .map((target: any) => ({
      playerId: target.playerId,
      ...(isNonEmptyString(target.shipInstanceId) ? { shipInstanceId: target.shipInstanceId } : {}),
    }));
  return targets;
}

function normalizeSolarLedgerEntry(value: unknown): AncientSolarLedgerEntry | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.entryId) ||
    !isNonEmptyString(value.solarPowerId) ||
    !['manual', 'autocast', 'cube'].includes(value.sourceMode)
  ) {
    return null;
  }

  const targets = normalizeTargetReferences(value.targets);
  const simulacrum = isObject(value.simulacrum) &&
      isNonEmptyString(value.simulacrum.sourceTargetInstanceId) &&
      isNonEmptyString(value.simulacrum.copiedShipDefId)
    ? {
        sourceTargetInstanceId: value.simulacrum.sourceTargetInstanceId,
        copiedShipDefId: value.simulacrum.copiedShipDefId,
        ...(isNonEmptyString(value.simulacrum.matchupKey) ? { matchupKey: value.simulacrum.matchupKey } : {}),
      }
    : undefined;

  return {
    entryId: value.entryId,
    order: normalizeAncientNumber(value.order),
    solarPowerId: value.solarPowerId,
    sourceMode: value.sourceMode,
    paidEnergy: normalizeEnergyPool(value.paidEnergy),
    ...(typeof value.lockedAmount !== 'undefined'
      ? { lockedAmount: normalizeAncientNumber(value.lockedAmount) }
      : {}),
    ...(targets ? { targets } : {}),
    ...(simulacrum ? { simulacrum } : {}),
  };
}

function normalizeSolarLedgerState(
  value: unknown,
  path: string,
  risks: AncientCompatibilityRisk[],
): AncientSolarLedgerState {
  const source = isObject(value) ? value : {};
  if (!isObject(value) && typeof value !== 'undefined') pushMalformedRisk(risks, path);
  return {
    battleTurnNumber: normalizeBattleTurnNumber(source.battleTurnNumber),
    entries: normalizeUniqueEntries({
      raw: source.entries,
      path: `${path}.entries`,
      risks,
      normalize(candidate) {
        const normalized = normalizeSolarLedgerEntry(candidate);
        return normalized
          ? { value: normalized, stableId: normalized.entryId, order: normalized.order }
          : null;
      },
    }),
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isNonEmptyString))].sort((a, b) => a.localeCompare(b));
}

function normalizeAcceptedDeclaration(value: unknown, playerId: string): AncientAcceptedDeclaration | null {
  if (
    !isObject(value) ||
    value.schemaVersion !== ANCIENT_STATE_SCHEMA_VERSION ||
    !isNonEmptyString(value.declarationId) ||
    value.playerId !== playerId ||
    !isObject(value.context) ||
    value.context.contextVersion !== ANCIENT_STATE_SCHEMA_VERSION ||
    !isObject(value.context.initialEnergy) ||
    !Array.isArray(value.context.energySourceIds)
  ) {
    return null;
  }
  const context = value.context;
  return {
    schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
    declarationId: value.declarationId,
    playerId,
    context: {
      contextVersion: ANCIENT_STATE_SCHEMA_VERSION,
      battleTurnNumber: normalizeBattleTurnNumber(context.battleTurnNumber),
      initialEnergy: normalizeEnergyPool(context.initialEnergy),
      energySourceIds: normalizeStringList(context.energySourceIds),
    },
  };
}

function normalizePendingSimulacrumCopy(value: unknown): AncientPendingSimulacrumCopy | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.pendingCopyId) ||
    !isNonEmptyString(value.declarationId) ||
    !isNonEmptyString(value.ownerPlayerId) ||
    !isNonEmptyString(value.sourceTargetInstanceId) ||
    !isNonEmptyString(value.copiedShipDefId) ||
    !['primary', 'cube'].includes(value.sourceMode) ||
    !['queued', 'materialized'].includes(value.status)
  ) {
    return null;
  }
  const configuration = isObject(value.permanentConfiguration) ? value.permanentConfiguration : {};
  return {
    pendingCopyId: value.pendingCopyId,
    declarationId: value.declarationId,
    ownerPlayerId: value.ownerPlayerId,
    sourceTargetInstanceId: value.sourceTargetInstanceId,
    copiedShipDefId: value.copiedShipDefId,
    queuedTurnNumber: normalizeAncientNumber(value.queuedTurnNumber),
    materializationTurnNumber: normalizeAncientNumber(value.materializationTurnNumber),
    capturedStartOfBattleCharges: normalizeAncientNumber(value.capturedStartOfBattleCharges),
    permanentConfiguration: {
      ...(typeof configuration.selectedNumber !== 'undefined'
        ? { selectedNumber: normalizeAncientNumber(configuration.selectedNumber) }
        : {}),
    },
    sourceMode: value.sourceMode,
    status: value.status,
    ...(isNonEmptyString(value.materializedInstanceId)
      ? { materializedInstanceId: value.materializedInstanceId }
      : {}),
  };
}

function normalizePendingBlackHoleDestruction(value: unknown): AncientPendingBlackHoleDestruction | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.pendingDestructionId) ||
    !isNonEmptyString(value.declarationId) ||
    !isNonEmptyString(value.ownerPlayerId) ||
    !isNonEmptyString(value.targetPlayerId) ||
    !['committed', 'resolved'].includes(value.status)
  ) {
    return null;
  }
  return {
    pendingDestructionId: value.pendingDestructionId,
    declarationId: value.declarationId,
    ownerPlayerId: value.ownerPlayerId,
    targetPlayerId: value.targetPlayerId,
    targetInstanceIds: normalizeStringList(value.targetInstanceIds),
    battleTurnNumber: normalizeAncientNumber(value.battleTurnNumber),
    lockedDamage: normalizeAncientNumber(value.lockedDamage),
    status: value.status,
  };
}

function normalizeRecordMap<T>(args: {
  raw: unknown;
  requiredPlayerIds?: string[];
  path: string;
  risks: AncientCompatibilityRisk[];
  createEmpty?: () => T;
  normalize: (value: unknown, playerId: string, path: string) => T | null;
}): Record<string, T> {
  const source = isObject(args.raw) ? args.raw : {};
  if (!isObject(args.raw) && typeof args.raw !== 'undefined') pushMalformedRisk(args.risks, args.path);
  const keys = new Set<string>([
    ...Object.keys(source).filter(isNonEmptyString),
    ...(args.requiredPlayerIds ?? []),
  ]);
  const result: Record<string, T> = {};
  for (const playerId of [...keys].sort((a, b) => a.localeCompare(b))) {
    const entryPath = `${args.path}.${playerId}`;
    const normalized = args.normalize(source[playerId], playerId, entryPath);
    if (normalized) {
      result[playerId] = normalized;
    } else if (args.createEmpty && (args.requiredPlayerIds ?? []).includes(playerId)) {
      result[playerId] = args.createEmpty();
    } else if (typeof source[playerId] !== 'undefined') {
      pushMalformedRisk(args.risks, entryPath);
    }
  }
  return result;
}

function sortRisks(risks: AncientCompatibilityRisk[]): AncientCompatibilityRisk[] {
  return risks.sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.code.localeCompare(b.code) ||
    (a.stableId ?? '').localeCompare(b.stableId ?? '') ||
    (a.actualVersion ?? -1) - (b.actualVersion ?? -1)
  );
}

export function normalizeAncientGameState<T = any>(state: T): AncientNormalizationResult<T> {
  if (!isObject(state)) {
    return { state, changed: false, compatibilityRisks: [] };
  }

  const compatibilityRisks: AncientCompatibilityRisk[] = [];
  const players = Array.isArray(state.players)
    ? state.players.map((player: any) => {
        if (!isObject(player)) return player;
        const { energy: _obsoleteEnergy, ...normalizedPlayer } = player;
        return normalizedPlayer;
      })
    : state.players;
  const playerSeatIds = getPlayerSeatIds(players);
  const rawGameData = isObject(state.gameData) ? state.gameData : {};
  const hasAncientFamily = Object.hasOwn(rawGameData, 'ancient');
  const rawAncientValue = rawGameData.ancient;
  const rawAncient = isObject(rawAncientValue) ? rawAncientValue : {};
  if (hasAncientFamily && !isObject(rawAncientValue)) {
    pushMalformedRisk(compatibilityRisks, 'gameData.ancient');
  } else if (isObject(rawAncientValue)) {
    const schemaVersion = rawAncientValue.schemaVersion;
    if (!Object.hasOwn(rawAncientValue, 'schemaVersion') || typeof schemaVersion === 'undefined') {
      compatibilityRisks.push({
        code: 'missing_ancient_schema_version',
        path: 'gameData.ancient.schemaVersion',
      });
    } else if (schemaVersion === ANCIENT_STATE_SCHEMA_VERSION) {
      // Current canonical version.
    } else if (
      typeof schemaVersion === 'number' &&
      Number.isInteger(schemaVersion) &&
      schemaVersion > ANCIENT_STATE_SCHEMA_VERSION
    ) {
      compatibilityRisks.push({
        code: 'unsupported_ancient_schema_version',
        path: 'gameData.ancient.schemaVersion',
        actualVersion: schemaVersion,
      });
    } else {
      compatibilityRisks.push({
        code: 'invalid_ancient_schema_version',
        path: 'gameData.ancient.schemaVersion',
      });
    }
  }

  const energyByPlayerId = normalizeRecordMap({
    raw: rawAncient.energyByPlayerId,
    requiredPlayerIds: playerSeatIds,
    path: 'gameData.ancient.energyByPlayerId',
    risks: compatibilityRisks,
    createEmpty: createEmptyAncientPlayerEnergyState,
    normalize: (value, _playerId, path) => normalizePlayerEnergyState(value, path, compatibilityRisks),
  });
  const solarLedgerByPlayerId = normalizeRecordMap({
    raw: rawAncient.solarLedgerByPlayerId,
    requiredPlayerIds: playerSeatIds,
    path: 'gameData.ancient.solarLedgerByPlayerId',
    risks: compatibilityRisks,
    createEmpty: createEmptyAncientSolarLedgerState,
    normalize: (value, _playerId, path) => normalizeSolarLedgerState(value, path, compatibilityRisks),
  });
  const acceptedDeclarationByPlayerId = normalizeRecordMap({
    raw: rawAncient.acceptedDeclarationByPlayerId,
    path: 'gameData.ancient.acceptedDeclarationByPlayerId',
    risks: compatibilityRisks,
    normalize: (value, playerId) => normalizeAcceptedDeclaration(value, playerId),
  });
  const pendingSimulacrumCopies = normalizeUniqueEntries({
    raw: rawAncient.pendingSimulacrumCopies,
    path: 'gameData.ancient.pendingSimulacrumCopies',
    risks: compatibilityRisks,
    normalize(candidate) {
      const normalized = normalizePendingSimulacrumCopy(candidate);
      return normalized ? { value: normalized, stableId: normalized.pendingCopyId } : null;
    },
  });
  const pendingBlackHoleDestructions = normalizeUniqueEntries({
    raw: rawAncient.pendingBlackHoleDestructions,
    path: 'gameData.ancient.pendingBlackHoleDestructions',
    risks: compatibilityRisks,
    normalize(candidate) {
      const normalized = normalizePendingBlackHoleDestruction(candidate);
      return normalized ? { value: normalized, stableId: normalized.pendingDestructionId } : null;
    },
  });

  const rawTurnData = isObject(rawGameData.turnData) ? rawGameData.turnData : rawGameData.turnData;
  let turnData = rawTurnData;
  if (isObject(rawTurnData) && Object.hasOwn(rawTurnData, 'pendingSOLARPowerDeclarations')) {
    const { pendingSOLARPowerDeclarations: _obsoleteSolarDeclarations, ...cleanTurnData } = rawTurnData;
    turnData = cleanTurnData;
  }

  const normalizedState = {
    ...state,
    ...(Array.isArray(players) ? { players } : {}),
    gameData: {
      ...rawGameData,
      ...(typeof turnData !== 'undefined' ? { turnData } : {}),
      ancient: {
        schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
        energyByPlayerId,
        acceptedDeclarationByPlayerId,
        solarLedgerByPlayerId,
        pendingSimulacrumCopies,
        pendingBlackHoleDestructions,
      },
    },
  } as T;

  return {
    state: normalizedState,
    changed: JSON.stringify(state) !== JSON.stringify(normalizedState),
    compatibilityRisks: sortRisks(compatibilityRisks),
  };
}

function getPlayerSpecies(player: any): unknown {
  return player?.faction ?? player?.species;
}

const ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID = {
  PLU: {
    rank: 0,
    amounts: { green: 1, red: 0, blue: 0 },
  },
  MER: {
    rank: 1,
    amounts: { green: 0, red: 1, blue: 0 },
  },
  NEP: {
    rank: 2,
    amounts: { green: 0, red: 0, blue: 1 },
  },
} as const;

type AncientCoreShipDefId = keyof typeof ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID;

function isAncientCoreShipDefId(value: unknown): value is AncientCoreShipDefId {
  return typeof value === 'string' && Object.hasOwn(ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID, value);
}

export function applyAncientCoreEnergyAtBattleReveal<T = any>(state: T): T {
  const canonicalState = state as any;
  const battleTurnNumber = normalizeAncientNumber(
    canonicalState.gameData.turnNumber ??
      canonicalState.gameData.turnData?.turnNumber ??
      canonicalState.turnNumber ??
      0,
  );
  const energyByPlayerId: Record<string, AncientPlayerEnergyState> = {};

  for (const playerId of getPlayerSeatIds(canonicalState.players)) {
    const player = canonicalState.players.find((candidate: any) => candidate?.id === playerId);
    const sources: AncientEnergySource[] = [];

    if (getPlayerSpecies(player) === 'ancient') {
      const coreShips = Array.isArray(canonicalState.gameData.ships?.[playerId])
        ? canonicalState.gameData.ships[playerId]
          .filter((ship: any) =>
            isNonEmptyString(ship?.instanceId) && isAncientCoreShipDefId(ship?.shipDefId)
          )
          .sort((a: any, b: any) => {
            const rankDifference = ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID[a.shipDefId as AncientCoreShipDefId].rank -
              ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID[b.shipDefId as AncientCoreShipDefId].rank;
            return rankDifference || a.instanceId.localeCompare(b.instanceId);
          })
        : [];

      for (const [order, ship] of coreShips.entries()) {
        const shipDefId = ship.shipDefId as AncientCoreShipDefId;
        sources.push({
          sourceId:
            `ancient-core-energy:${battleTurnNumber}:${playerId}:${shipDefId}:${ship.instanceId}`,
          sourceInstanceId: ship.instanceId,
          sourceShipDefId: shipDefId,
          battleTurnNumber,
          order,
          amounts: { ...ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID[shipDefId].amounts },
        });
      }
    }

    const pool = sources.reduce<AncientEnergyPool>(
      (total, source) => ({
        green: total.green + source.amounts.green,
        red: total.red + source.amounts.red,
        blue: total.blue + source.amounts.blue,
      }),
      createEmptyAncientEnergyPool(),
    );

    energyByPlayerId[playerId] = {
      battleTurnNumber,
      pool,
      sources,
    };
  }

  canonicalState.gameData.ancient.energyByPlayerId = energyByPlayerId;
  return state;
}

export function getAuthoritativeAncientEnergyTotal(state: any, playerId: string): number {
  const player = Array.isArray(state?.players)
    ? state.players.find((candidate: any) => candidate?.id === playerId)
    : undefined;
  if (player?.role !== 'player' || getPlayerSpecies(player) !== 'ancient') return 0;
  const pool = state?.gameData?.ancient?.energyByPlayerId?.[playerId]?.pool;
  return normalizeAncientNumber(pool?.green) +
    normalizeAncientNumber(pool?.red) +
    normalizeAncientNumber(pool?.blue);
}

export function projectPublicAncientState(normalizedState: any): {
  schemaVersion: 1;
  energyByPlayerId: Record<string, AncientPlayerEnergyState>;
  solarLedgerByPlayerId: Record<string, AncientSolarLedgerState>;
} {
  const ancient = normalizedState?.gameData?.ancient as AncientState;
  const energyByPlayerId: Record<string, AncientPlayerEnergyState> = {};
  const solarLedgerByPlayerId: Record<string, AncientSolarLedgerState> = {};
  for (const playerId of getPlayerSeatIds(normalizedState?.players)) {
    energyByPlayerId[playerId] = structuredClone(
      ancient.energyByPlayerId[playerId] ?? createEmptyAncientPlayerEnergyState(),
    );
    solarLedgerByPlayerId[playerId] = structuredClone(
      ancient.solarLedgerByPlayerId[playerId] ?? createEmptyAncientSolarLedgerState(),
    );
  }
  return {
    schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
    energyByPlayerId,
    solarLedgerByPlayerId,
  };
}

function sanitizePlayers(players: unknown): unknown {
  if (!Array.isArray(players)) return players;
  return players.map((player) => {
    if (!isObject(player)) return player;
    const { energy: _obsoleteEnergy, ...safePlayer } = player;
    return safePlayer;
  });
}

export function sanitizeAncientStateForClient<T = any>(state: T): T {
  if (!isObject(state)) return state;
  const gameData = isObject(state.gameData) ? state.gameData : null;
  if (!gameData) {
    return {
      ...state,
      ...(Array.isArray(state.players) ? { players: sanitizePlayers(state.players) } : {}),
    } as T;
  }
  const { ancient: _internalAncient, ...safeGameData } = gameData;
  const turnData = isObject(safeGameData.turnData) ? safeGameData.turnData : null;
  if (turnData) {
    const { pendingSOLARPowerDeclarations: _obsoleteSolarDeclarations, ...safeTurnData } = turnData;
    safeGameData.turnData = safeTurnData;
  }
  if (Array.isArray(safeGameData.players)) {
    safeGameData.players = sanitizePlayers(safeGameData.players);
  }
  return {
    ...state,
    ...(Array.isArray(state.players) ? { players: sanitizePlayers(state.players) } : {}),
    gameData: safeGameData,
  } as T;
}
