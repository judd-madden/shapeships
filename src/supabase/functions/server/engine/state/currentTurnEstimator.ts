import type { BuildSubmitPayload } from "../intent/IntentTypes.ts";
import {
  resolvePlayerBuildSubmitAuthoritatively,
} from "../intent/buildSubmitResolution.ts";
import { applyAncientBattleRevealPreparation } from "./ancientState.ts";
import {
  projectChargeDeclarationStateForViewer,
} from "./chargeDeclarationVisibility.ts";
import {
  projectDrawingPreludeFleetsForViewerWithAvailability,
} from "./drawingPreludeProjection.ts";
import {
  formatBattleLogBuildLinesFromCaptureEvents,
} from "./battleLogHistory.ts";
import type {
  GameState,
  LastTurnBreakdownRow,
  ShipInstance,
} from "./GameStateTypes.ts";
import {
  type Effect,
  EffectKind,
  EffectTiming,
} from "../../engine_shared/effects/Effect.ts";
import { applyEffects } from "../../engine_shared/effects/applyEffects.ts";
import { getEffectiveDiceRollForPlayer } from "../../engine_shared/resolve/phaseComputedEffects.ts";
import {
  buildLastTurnBreakdownSnapshots,
  collectCanonicalEndOfTurnEffects,
  resolveRevealSpecialPowers,
} from "../../engine_shared/resolve/resolvePhase.ts";

export type CurrentTurnEstimateStatus =
  | "estimated"
  | "privacy_frozen"
  | "unavailable";

export type CurrentTurnEstimateUnavailableReason =
  | "game_not_active"
  | "invalid_active_players"
  | "invalid_requester"
  | "invalid_estimated_player"
  | "unsupported_phase"
  | "drawing_snapshot_unavailable"
  | "draft_required"
  | "draft_not_allowed"
  | "turn_already_resolved"
  | "charge_snapshot_unavailable"
  | "quantum_reveal_facts_unavailable"
  | "source_context_changed";

export type CurrentTurnEstimateIdentity = {
  gameId: string;
  turnNumber: number;
  sourcePhase: string;
  sourceContextKey: string;
  draftKey: string;
  evaluatedDraft: BuildSubmitPayload | null;
};

export type CurrentTurnBuildSkipFact = {
  kind: "attempt" | "evolver";
  shipDefId?: string;
  attemptIndex?: number;
  sourceKey?: string;
  reason: string;
  restrictionCode?: string;
};

export type CurrentTurnBuildFacts = {
  lines: string[];
  skipped: CurrentTurnBuildSkipFact[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
};

export type SolarGridRevealTransition = {
  from: number;
  to: number;
  count: number;
};

type CurrentTurnEstimateBase = {
  status: CurrentTurnEstimateStatus;
  identity: CurrentTurnEstimateIdentity;
  playerId: string;
};

export type CurrentTurnEstimateAvailableResult = CurrentTurnEstimateBase & {
  status: "estimated" | "privacy_frozen";
  opponentPlayerId: string;
  damage: number;
  healing: number;
  damageRows: LastTurnBreakdownRow[];
  healingRows: LastTurnBreakdownRow[];
  build: CurrentTurnBuildFacts;
  reveal: {
    solarGridChargeTransitions: SolarGridRevealTransition[];
  };
};

export type CurrentTurnEstimateUnavailableResult = CurrentTurnEstimateBase & {
  status: "unavailable";
  reason: CurrentTurnEstimateUnavailableReason;
};

export type CurrentTurnEstimateResult =
  | CurrentTurnEstimateAvailableResult
  | CurrentTurnEstimateUnavailableResult;

export type EstimateCurrentTurnForPlayerArgs = {
  state: Readonly<GameState>;
  requestingParticipantId?: string;
  playerId: string;
  draft: BuildSubmitPayload | null;
  expectedSourceContextKey?: string;
};

type PreparedEstimateState = {
  state: GameState;
  status: "estimated" | "privacy_frozen";
  phaseKey: string;
  turnNumber: number;
  opponentPlayerId: string;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPhaseKey(state: Readonly<any>): string {
  const gameData = state?.gameData;
  const turnData = gameData?.turnData;
  const major = gameData?.currentPhase ?? turnData?.currentMajorPhase;
  const sub = gameData?.currentSubPhase ?? turnData?.currentSubPhase;
  return typeof major === "string" && typeof sub === "string"
    ? `${major}.${sub}`
    : "";
}

function getTurnNumber(state: Readonly<any>): number {
  const value = state?.gameData?.turnNumber ??
    state?.gameData?.turnData?.turnNumber;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function cloneDraft(
  draft: BuildSubmitPayload | null,
): BuildSubmitPayload | null {
  return draft === null ? null : structuredClone(draft);
}

function normalizeDraftIdentity(
  draft: BuildSubmitPayload | null,
): unknown {
  if (draft === null) return null;
  const frigateCount = draft.builds
    .filter((build) => build.shipDefId === "FRI")
    .reduce((total, build) => total + build.count, 0);
  return {
    builds: draft.builds.map((build) => ({
      shipDefId: build.shipDefId,
      count: build.count,
    })),
    frigateTriggers: draft.frigateTriggers ??
      Array.from({ length: frigateCount }, () => 1),
    quantumMysticSelections: draft.quantumMysticSelections ?? [],
    evolverChoices: draft.evolverChoices ?? [],
  };
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (isObject(value)) {
    return `{${
      Object.keys(value)
        .filter((key) => typeof value[key] !== "undefined")
        .sort((left, right) => left.localeCompare(right))
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
        .join(",")
    }}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hashStableValue(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

export function getCurrentTurnDraftKey(
  draft: BuildSubmitPayload | null,
): string {
  return hashStableValue(normalizeDraftIdentity(draft));
}

function baseIdentity(args: {
  state: Readonly<any>;
  phaseKey: string;
  draft: BuildSubmitPayload | null;
  sourceContext: unknown;
}): CurrentTurnEstimateIdentity {
  return {
    gameId: typeof args.state?.gameId === "string" ? args.state.gameId : "",
    turnNumber: getTurnNumber(args.state),
    sourcePhase: args.phaseKey,
    sourceContextKey: hashStableValue(args.sourceContext),
    draftKey: getCurrentTurnDraftKey(args.draft),
    evaluatedDraft: cloneDraft(args.draft),
  };
}

function unavailable(
  args: EstimateCurrentTurnForPlayerArgs & {
    phaseKey: string;
    reason: CurrentTurnEstimateUnavailableReason;
  },
): CurrentTurnEstimateUnavailableResult {
  return {
    status: "unavailable",
    reason: args.reason,
    playerId: args.playerId,
    identity: baseIdentity({
      state: args.state,
      phaseKey: args.phaseKey,
      draft: args.draft,
      sourceContext: { reason: args.reason },
    }),
  };
}

function normalizeFiniteResource(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function cloneSimulationPlayer(player: any, includeResources: boolean): any {
  return {
    id: player.id,
    role: "player",
    ...(typeof player.faction === "string" ? { faction: player.faction } : {}),
    ...(typeof player.species === "string" ? { species: player.species } : {}),
    health: typeof player.health === "number" && Number.isFinite(player.health)
      ? player.health
      : 0,
    lines: includeResources ? normalizeFiniteResource(player.lines) : 0,
    joiningLines: includeResources
      ? normalizeFiniteResource(player.joiningLines)
      : 0,
  };
}

function getShipIds(ships: readonly ShipInstance[]): Set<string> {
  return new Set(
    ships
      .map((ship) => ship?.instanceId)
      .filter((instanceId): instanceId is string =>
        typeof instanceId === "string" && instanceId.length > 0
      ),
  );
}

function filterFrigateMemory(
  source: Readonly<any>,
  relevantShipIds: ReadonlySet<string>,
): Record<string, number> {
  const raw = source?.gameData?.powerMemory?.frigateTriggerByInstanceId;
  if (!isObject(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([instanceId, trigger]) =>
        relevantShipIds.has(instanceId) &&
        Number.isInteger(trigger) &&
        (trigger as number) >= 1 &&
        (trigger as number) <= 6
      )
      .map(([instanceId, trigger]) => [instanceId, trigger as number]),
  );
}

function filterOnceOnlyMemory(
  source: Readonly<any>,
  relevantShipIds: ReadonlySet<string>,
): Record<string, boolean> {
  const raw = source?.gameData?.powerMemory?.onceOnlyFired;
  if (!isObject(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([key, fired]) =>
      fired === true &&
      [...relevantShipIds].some((instanceId) =>
        key.startsWith(`${instanceId}::`)
      )
    ),
  );
}

function recoverPublicQuantumRevealMemory(args: {
  source: Readonly<any>;
  fleets: Record<string, ShipInstance[]>;
  activePlayerIds: readonly string[];
  turnNumber: number;
}):
  | Record<string, { battleTurnNumber: number; controllerPlayerId: string }>
  | null {
  const liveQuantumByInstanceId = new Map<
    string,
    { ship: ShipInstance; currentControllerPlayerId: string }
  >();
  for (const [currentControllerPlayerId, fleet] of Object.entries(args.fleets)) {
    for (const ship of fleet) {
      if (ship.shipDefId === "QUA") {
        liveQuantumByInstanceId.set(ship.instanceId, {
          ship,
          currentControllerPlayerId,
        });
      }
    }
  }
  if (liveQuantumByInstanceId.size === 0) return {};

  if (
    args.source?.gameData?.turnData?.ancientBattleRevealPreparedTurnNumber !==
      args.turnNumber
  ) {
    return null;
  }
  const raw = args.source?.gameData?.powerMemory
    ?.quantumMysticRevealByInstanceId;
  if (!isObject(raw)) return null;

  const recovered: Record<
    string,
    { battleTurnNumber: number; controllerPlayerId: string }
  > = {};
  const phaseKey = getPhaseKey(args.source);
  const turnPhaseProgress = args.source?.gameData?.turnData?.turnPhaseProgress;
  const firstStrikeWasNotExpected =
    turnPhaseProgress?.turnNumber === args.turnNumber &&
    turnPhaseProgress?.firstStrike?.expected === false;
  const currentControllerIsRevealController =
    phaseKey === "battle.reveal" ||
    phaseKey === "battle.first_strike" ||
    (phaseKey === "battle.charge_declaration" &&
      firstStrikeWasNotExpected);

  for (
    const [instanceId, { ship, currentControllerPlayerId }] of
      liveQuantumByInstanceId
  ) {
    if (!Object.prototype.hasOwnProperty.call(raw, instanceId)) {
      const selectedNumber = ship.permanentConfiguration?.selectedNumber;
      const possibleRevealControllers = currentControllerIsRevealController
        ? [currentControllerPlayerId]
        : args.activePlayerIds;
      const couldHaveMatchedAtReveal = Number.isInteger(selectedNumber) &&
        possibleRevealControllers.some((playerId) =>
          getEffectiveDiceRollForPlayer(args.source as GameState, playerId) ===
            selectedNumber
        );
      if (couldHaveMatchedAtReveal) return null;
      continue;
    }
    const record = raw[instanceId];
    if (
      !isObject(record) ||
      record.battleTurnNumber !== args.turnNumber ||
      typeof record.controllerPlayerId !== "string" ||
      !args.activePlayerIds.includes(record.controllerPlayerId)
    ) {
      return null;
    }
    const selectedNumber = ship.permanentConfiguration?.selectedNumber;
    const effectiveRoll = getEffectiveDiceRollForPlayer(
      args.source as GameState,
      record.controllerPlayerId,
    );
    if (
      !Number.isInteger(selectedNumber) ||
      selectedNumber !== effectiveRoll
    ) {
      return null;
    }
    recovered[instanceId] = {
      battleTurnNumber: args.turnNumber,
      controllerPlayerId: record.controllerPlayerId,
    };
  }
  return recovered;
}

function prepareEstimateState(
  args: EstimateCurrentTurnForPlayerArgs,
): PreparedEstimateState | CurrentTurnEstimateUnavailableResult {
  const phaseKey = getPhaseKey(args.state);
  const turnNumber = getTurnNumber(args.state);
  if (args.state.status !== "active") {
    return unavailable({ ...args, phaseKey, reason: "game_not_active" });
  }

  const activePlayers = Array.isArray(args.state.players)
    ? args.state.players.filter((player: any) =>
      player?.role === "player" && typeof player?.id === "string"
    )
    : [];
  if (activePlayers.length !== 2) {
    return unavailable({ ...args, phaseKey, reason: "invalid_active_players" });
  }
  const activePlayerIds = activePlayers.map((player: any) =>
    player.id as string
  );
  const estimatedPlayer = activePlayers.find((player: any) =>
    player.id === args.playerId
  );
  if (!estimatedPlayer) {
    return unavailable({
      ...args,
      phaseKey,
      reason: "invalid_estimated_player",
    });
  }
  const opponent = activePlayers.find((player: any) =>
    player.id !== args.playerId
  )!;

  const drawing = phaseKey === "build.drawing";
  const battlePublic = phaseKey === "battle.reveal" ||
    phaseKey === "battle.first_strike" ||
    phaseKey === "battle.charge_declaration";
  if (!drawing && !battlePublic) {
    return unavailable({ ...args, phaseKey, reason: "unsupported_phase" });
  }
  if (
    args.state.gameData?.turnData?.endOfTurnResolutionAppliedTurnNumber ===
      turnNumber
  ) {
    return unavailable({ ...args, phaseKey, reason: "turn_already_resolved" });
  }
  if (drawing && args.requestingParticipantId !== args.playerId) {
    return unavailable({ ...args, phaseKey, reason: "invalid_requester" });
  }
  if (drawing && args.draft === null) {
    return unavailable({ ...args, phaseKey, reason: "draft_required" });
  }
  if (!drawing && args.draft !== null) {
    return unavailable({ ...args, phaseKey, reason: "draft_not_allowed" });
  }

  let visibleSource: Readonly<any> = args.state;
  let fleets: Record<string, ShipInstance[]>;
  let estimateStatus: "estimated" | "privacy_frozen" = "estimated";

  if (drawing) {
    const projection = projectDrawingPreludeFleetsForViewerWithAvailability(
      args.state,
      args.state.gameData?.ships,
      args.requestingParticipantId,
    );
    if (
      !projection.projectionAvailable ||
      projection.source !== "validated_snapshot"
    ) {
      return unavailable({
        ...args,
        phaseKey,
        reason: "drawing_snapshot_unavailable",
      });
    }
    fleets = projection.fleets;
  } else if (phaseKey === "battle.charge_declaration") {
    const projection = projectChargeDeclarationStateForViewer(
      args.state,
      undefined,
    );
    if (!projection.structuralProjectionAvailable) {
      return unavailable({
        ...args,
        phaseKey,
        reason: "charge_snapshot_unavailable",
      });
    }
    visibleSource = projection.state;
    fleets = structuredClone(projection.state.gameData?.ships ?? {});
    estimateStatus = "privacy_frozen";
  } else {
    fleets = structuredClone(args.state.gameData?.ships ?? {});
  }

  if (activePlayerIds.some((playerId) => !Array.isArray(fleets[playerId]))) {
    return unavailable({
      ...args,
      phaseKey,
      reason: drawing
        ? "drawing_snapshot_unavailable"
        : "charge_snapshot_unavailable",
    });
  }
  fleets = Object.fromEntries(
    activePlayerIds.map((playerId) => [
      playerId,
      structuredClone(fleets[playerId]),
    ]),
  );

  const visiblePlayers = Array.isArray(visibleSource.players)
    ? visibleSource.players
    : activePlayers;
  const simulationPlayers = activePlayerIds.map((playerId) => {
    const player = visiblePlayers.find((candidate: any) =>
      candidate?.id === playerId
    ) ??
      activePlayers.find((candidate: any) => candidate.id === playerId);
    return cloneSimulationPlayer(player, playerId === args.playerId);
  });

  const subjectFleet = fleets[args.playerId] ?? [];
  const canonicalVoid = drawing
    ? args.state.gameData?.voidShipsByPlayerId?.[args.playerId]
    : visibleSource.gameData?.voidShipsByPlayerId?.[args.playerId];
  const subjectVoid = Array.isArray(canonicalVoid)
    ? structuredClone(canonicalVoid)
    : [];
  const sourceTurnData = args.state.gameData?.turnData ?? {};
  const removedByInstanceId = sourceTurnData
    .buildPhaseNonDestroyRemovedShipsByPlayerId?.[args.playerId];
  const subjectRemoved = isObject(removedByInstanceId)
    ? structuredClone(removedByInstanceId)
    : {};
  const relevantShipIds = getShipIds([
    ...subjectFleet,
    ...subjectVoid,
    ...Object.values(subjectRemoved) as ShipInstance[],
  ]);

  let quantumMysticRevealByInstanceId: Record<
    string,
    { battleTurnNumber: number; controllerPlayerId: string }
  > = {};
  if (!drawing) {
    const recovered = recoverPublicQuantumRevealMemory({
      source: args.state,
      fleets,
      activePlayerIds,
      turnNumber,
    });
    if (recovered === null) {
      return unavailable({
        ...args,
        phaseKey,
        reason: "quantum_reveal_facts_unavailable",
      });
    }
    quantumMysticRevealByInstanceId = recovered;
  }

  const dreadnoughtComponents = sourceTurnData
    .dreadnoughtConsumedCurrentTurnComponentsByInstanceId;
  const filteredDreadnoughtComponents = isObject(dreadnoughtComponents)
    ? Object.fromEntries(
      Object.entries(dreadnoughtComponents).filter(([instanceId, count]) =>
        relevantShipIds.has(instanceId) &&
        Number.isInteger(count) &&
        (count as number) >= 0
      ),
    )
    : {};
  const cubeSelection = sourceTurnData.cubeDiceSelectionByPlayerId
    ?.[args.playerId];
  const rawEffectiveDiceRollByPlayerId = sourceTurnData.effectiveDiceRollByPlayerId;
  const effectiveDiceRollByPlayerId = Object.fromEntries(
    activePlayerIds.flatMap((playerId) => {
      const roll = rawEffectiveDiceRollByPlayerId?.[playerId];
      return Number.isInteger(roll) ? [[playerId, roll]] : [];
    }),
  );
  const diceOverrideSourceByPlayerId = Object.fromEntries(
    activePlayerIds.flatMap((playerId) => {
      const source = sourceTurnData.diceOverrideSourceByPlayerId?.[playerId];
      return typeof source === "string" ? [[playerId, source]] : [];
    }),
  );

  const safeState: GameState = {
    gameId: args.state.gameId,
    status: "active",
    players: simulationPlayers,
    gameData: {
      turnNumber,
      currentPhase: phaseKey.split(".")[0],
      currentSubPhase: phaseKey.split(".")[1],
      ships: structuredClone(fleets),
      voidShipsByPlayerId: { [args.playerId]: subjectVoid },
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      powerMemory: {
        onceOnlyFired: filterOnceOnlyMemory(args.state, relevantShipIds),
        frigateTriggerByInstanceId: filterFrigateMemory(
          args.state,
          relevantShipIds,
        ),
        quantumMysticRevealByInstanceId,
      },
      turnData: {
        turnNumber,
        currentMajorPhase: phaseKey.split(".")[0],
        currentSubPhase: phaseKey.split(".")[1],
        baseDiceRoll: sourceTurnData.baseDiceRoll,
        diceRoll: sourceTurnData.diceRoll,
        effectiveDiceRoll: sourceTurnData.effectiveDiceRoll,
        effectiveDiceRollByPlayerId,
        diceOverrideSourceByPlayerId,
        cubeDiceSelectionByPlayerId: cubeSelection
          ? { [args.playerId]: structuredClone(cubeSelection) }
          : {},
        shipsMadeThisTurnByPlayerId: {
          [args.playerId]:
            sourceTurnData.shipsMadeThisTurnByPlayerId?.[args.playerId] ?? 0,
        },
        queenCreatedXenitesThisTurnByPlayerId: {
          [args.playerId]: sourceTurnData.queenCreatedXenitesThisTurnByPlayerId
            ?.[args.playerId] ?? 0,
        },
        dreadnoughtConsumedCurrentTurnComponentsByInstanceId:
          filteredDreadnoughtComponents,
        buildPhaseNonDestroyRemovedShipsByPlayerId: {
          [args.playerId]: subjectRemoved,
        },
        revealSpecialPowersAppliedTurnNumber: drawing
          ? 0
          : sourceTurnData.revealSpecialPowersAppliedTurnNumber,
        ancientBattleRevealPreparedTurnNumber: drawing
          ? 0
          : sourceTurnData.ancientBattleRevealPreparedTurnNumber,
      },
    } as any,
  };

  return {
    state: safeState,
    status: estimateStatus,
    phaseKey,
    turnNumber,
    opponentPlayerId: opponent.id,
  };
}

function collectStableBuildSkips(
  events: readonly any[],
): CurrentTurnBuildSkipFact[] {
  return events.flatMap((event): CurrentTurnBuildSkipFact[] => {
    if (event?.type === "BUILD_ATTEMPT_SKIPPED") {
      return [{
        kind: "attempt",
        shipDefId: event.shipDefId,
        attemptIndex: event.attemptIndex,
        reason: String(event.reason ?? "unknown"),
        ...(typeof event.restrictionCode === "string"
          ? { restrictionCode: event.restrictionCode }
          : {}),
      }];
    }
    if (event?.type === "BUILD_EVOLVER_SKIPPED") {
      return [{
        kind: "evolver",
        sourceKey: event.sourceKey,
        reason: String(event.reason ?? "unknown"),
      }];
    }
    return [];
  });
}

function getSolarChargesByInstanceId(
  state: Readonly<GameState>,
  playerId: string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const ship of state.gameData.ships?.[playerId] ?? []) {
    if (ship.shipDefId !== "SOL") continue;
    result.set(ship.instanceId, normalizeFiniteResource(ship.chargesCurrent));
  }
  return result;
}

function buildSolarTransitions(
  before: ReadonlyMap<string, number>,
  afterState: Readonly<GameState>,
  playerId: string,
): SolarGridRevealTransition[] {
  const counts = new Map<string, SolarGridRevealTransition>();
  for (const ship of afterState.gameData.ships?.[playerId] ?? []) {
    if (ship.shipDefId !== "SOL") continue;
    const from = before.get(ship.instanceId);
    if (typeof from !== "number") continue;
    const to = normalizeFiniteResource(ship.chargesCurrent);
    const key = `${from}:${to}`;
    const current = counts.get(key) ?? { from, to, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort((left, right) =>
    left.from - right.from || left.to - right.to
  );
}

function isAllowedEstimateEffect(
  effect: Effect,
  playerId: string,
  opponentPlayerId: string,
): boolean {
  return effect.ownerPlayerId === playerId &&
    (effect.kind === EffectKind.Damage || effect.kind === EffectKind.Heal) &&
    (effect.activationTag === EffectTiming.Automatic ||
      effect.activationTag === EffectTiming.OnceOnly) &&
    (effect.target.playerId === playerId ||
      effect.target.playerId === opponentPlayerId);
}

function sumRows(rows: readonly LastTurnBreakdownRow[]): number {
  return rows.reduce((total, row) => total + row.amount, 0);
}

export function estimateCurrentTurnForPlayer(
  args: EstimateCurrentTurnForPlayerArgs,
): CurrentTurnEstimateResult {
  const prepared = prepareEstimateState(args);
  if (prepared.status === "unavailable") return prepared;

  const identity = baseIdentity({
    state: args.state,
    phaseKey: prepared.phaseKey,
    draft: args.draft,
    sourceContext: prepared.state,
  });
  if (
    typeof args.expectedSourceContextKey === "string" &&
    args.expectedSourceContextKey !== identity.sourceContextKey
  ) {
    return {
      status: "unavailable",
      reason: "source_context_changed",
      playerId: args.playerId,
      identity,
    };
  }
  let workingState = structuredClone(prepared.state);
  const simulationEvents: any[] = [];
  let solarGridChargeTransitions: SolarGridRevealTransition[] = [];

  if (prepared.phaseKey === "build.drawing") {
    const frozenOpponentFleet = structuredClone(
      workingState.gameData.ships?.[prepared.opponentPlayerId] ?? [],
    );
    simulationEvents.push(...resolvePlayerBuildSubmitAuthoritatively({
      state: workingState,
      playerId: args.playerId,
      turnNumber: prepared.turnNumber,
      nowMs: 0,
      payload: args.draft,
    }));

    const solarBeforeReveal = getSolarChargesByInstanceId(
      workingState,
      args.playerId,
    );
    const reveal = resolveRevealSpecialPowers(workingState);
    workingState = reveal.state;
    simulationEvents.push(...reveal.events);
    workingState = applyAncientBattleRevealPreparation(workingState);
    workingState.gameData.ships![prepared.opponentPlayerId] = frozenOpponentFleet;
    solarGridChargeTransitions = buildSolarTransitions(
      solarBeforeReveal,
      workingState,
      args.playerId,
    );
  }

  workingState = {
    ...workingState,
    gameData: {
      ...workingState.gameData,
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
    },
  };

  const collected = collectCanonicalEndOfTurnEffects(workingState);
  const allowedEffects = collected.effects.filter((effect) =>
    isAllowedEstimateEffect(effect, args.playerId, prepared.opponentPlayerId)
  );
  const applied = applyEffects(collected.state, allowedEffects, {
    baseAmountByEffectId: collected.baseAmountByEffectId,
  });
  const totals = {
    damageByPlayerId: {
      ...(applied.state.gameData.pendingTurn?.damageByPlayerId ?? {}),
    },
    healByPlayerId: {
      ...(applied.state.gameData.pendingTurn?.healByPlayerId ?? {}),
    },
  };
  const breakdowns = buildLastTurnBreakdownSnapshots(applied.state, totals);
  const damageRows = breakdowns.damageDealtByPlayerId[args.playerId] ?? [];
  const healingRows = breakdowns.healingReceivedByPlayerId[args.playerId] ?? [];
  const simulatedPlayer = applied.state.players.find((player) =>
    player.id === args.playerId
  );

  return {
    status: prepared.status,
    identity,
    playerId: args.playerId,
    opponentPlayerId: prepared.opponentPlayerId,
    damage: sumRows(damageRows),
    healing: sumRows(healingRows),
    damageRows,
    healingRows,
    build: {
      lines: formatBattleLogBuildLinesFromCaptureEvents({
        turnNumber: prepared.turnNumber,
        playerId: args.playerId,
        events: simulationEvents,
      }),
      skipped: collectStableBuildSkips(simulationEvents),
      remainingOrdinaryLines: normalizeFiniteResource(simulatedPlayer?.lines),
      remainingJoiningLines: normalizeFiniteResource(
        simulatedPlayer?.joiningLines,
      ),
    },
    reveal: { solarGridChargeTransitions },
  };
}
