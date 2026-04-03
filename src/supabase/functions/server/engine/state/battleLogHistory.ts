import type { EffectEvent } from "../../engine_shared/effects/applyEffects.ts";
import type { Effect } from "../../engine_shared/effects/Effect.ts";

export type BattleLogHistoryResponse = {
  gameId: string;
  revision: number;
  completedTurnCount: number;
  turns: BattleLogTurnSummary[];
};

export type BattleLogTurnSummary = {
  turnNumber: number;
  diceValue: number | null;
  players: Array<{
    playerId: string;
    name: string;
    healthEnd: number;
    healthDelta: number;
  }>;
  buildLinesByPlayerId: Record<string, string[]>;
  battleLinesByPlayerId: Record<string, string[]>;
};

type BuildCaptureAtom =
  | {
      kind: "reroll";
      sourceShipDefId: string;
      values: number[];
    }
  | {
      kind: "manual_build";
      shipDefId: string;
    }
  | {
      kind: "produced_build";
      shipDefId: string;
      sourceShipDefId: string;
      count: number;
    };

type BattleCaptureAtom =
  | {
      kind: "charge_action";
      sourceShipDefId: string;
      actionLabel: "Heal" | "Damage";
      bucket: 2;
    }
  | {
      kind: "destroy";
      sourceShipDefId: string;
      targetShipDefIds: string[];
      bucket: 1 | 2;
    }
  | {
      kind: "steal";
      sourceShipDefId: string;
      targetShipDefIds: string[];
      bucket: 1 | 2;
    };

export type BattleLogCurrentTurnCapture = {
  turnNumber: number;
  diceValue: number | null;
  buildAtomsByPlayerId: Record<string, BuildCaptureAtom[]>;
  battleAtomsByPlayerId: Record<string, BattleCaptureAtom[]>;
};

type BattleLogCaptureEvent =
  | {
      type: "BATTLE_LOG_CAPTURE_BUILD_REROLL";
      turnNumber: number;
      playerId: string;
      sourceShipDefId: string;
      fromValue: number;
      toValue: number;
    }
  | {
      type: "BATTLE_LOG_CAPTURE_BUILD_MANUAL";
      turnNumber: number;
      playerId: string;
      shipDefId: string;
    }
  | {
      type: "BATTLE_LOG_CAPTURE_BUILD_PRODUCED";
      turnNumber: number;
      playerId: string;
      shipDefId: string;
      sourceShipDefId: string;
      count: number;
    }
  | {
      type: "BATTLE_LOG_CAPTURE_BATTLE_CHARGE_ACTION";
      turnNumber: number;
      playerId: string;
      sourceShipDefId: string;
      actionLabel: "Heal" | "Damage";
    }
  | {
      type: "BATTLE_LOG_CAPTURE_BATTLE_DESTROY";
      turnNumber: number;
      playerId: string;
      sourceShipDefId: string;
      targetShipDefIds: string[];
      bucket: 1 | 2;
    }
  | {
      type: "BATTLE_LOG_CAPTURE_BATTLE_STEAL";
      turnNumber: number;
      playerId: string;
      sourceShipDefId: string;
      targetShipDefIds: string[];
      bucket: 1 | 2;
    };

export type BattleLogHistoryStore = {
  gameId: string;
  revision: number;
  completedTurnCount: number;
  turns: BattleLogTurnSummary[];
  currentTurnCapture: BattleLogCurrentTurnCapture | null;
};

type PlayerWithState = {
  id: string;
  name?: string;
  role?: string;
  health?: number;
};

type GameStateLike = {
  status?: string;
  resultReason?: string | null;
  players?: PlayerWithState[];
  gameData?: {
    turnNumber?: number;
    currentPhase?: string;
    currentSubPhase?: string;
    lastTurnNetByPlayerId?: Record<string, number>;
    ships?: Record<string, Array<{ instanceId?: string; shipDefId?: string }>>;
    voidShipsByPlayerId?: Record<string, Array<{ instanceId?: string; shipDefId?: string }>>;
    turnData?: Record<string, unknown> & {
      currentMajorPhase?: string;
      currentSubPhase?: string;
    };
  };
};

type CaptureResolutionArgs = {
  stateBeforeResolution: GameStateLike;
  turnNumber: number;
  playerId: string;
  effects: Effect[];
  effectEvents: EffectEvent[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getCurrentTurnNumber(state: GameStateLike | null | undefined): number {
  return state?.gameData?.turnNumber ?? 0;
}

function getPhaseKeyFromState(state: GameStateLike | null | undefined): string | null {
  const gameData = state?.gameData;
  const majorPhase = gameData?.currentPhase;
  const subPhase = gameData?.currentSubPhase;

  if (
    typeof majorPhase === "string" &&
    majorPhase.length > 0 &&
    typeof subPhase === "string" &&
    subPhase.length > 0
  ) {
    return `${majorPhase}.${subPhase}`;
  }

  const turnData = gameData?.turnData;
  const turnMajorPhase = turnData?.currentMajorPhase;
  const turnSubPhase = turnData?.currentSubPhase;

  if (
    typeof turnMajorPhase === "string" &&
    turnMajorPhase.length > 0 &&
    typeof turnSubPhase === "string" &&
    turnSubPhase.length > 0
  ) {
    return `${turnMajorPhase}.${turnSubPhase}`;
  }

  return null;
}

function isBattlePhaseKey(phaseKey: string | null): boolean {
  return typeof phaseKey === "string" && phaseKey.startsWith("battle.");
}

function isStartOfNextTurnBuild(
  state: GameStateLike | null | undefined,
  previousTurnNumber: number,
): boolean {
  return (
    getCurrentTurnNumber(state) === previousTurnNumber + 1 &&
    getPhaseKeyFromState(state) === "build.dice_roll"
  );
}

function getActivePlayers(state: GameStateLike | null | undefined): PlayerWithState[] {
  return Array.isArray(state?.players)
    ? state!.players!.filter((player) => player?.role === "player")
    : [];
}

function getShipDefIdByInstanceId(
  state: GameStateLike,
  instanceId: string,
): string | null {
  const shipsByPlayerId = state?.gameData?.ships ?? {};
  for (const fleet of Object.values(shipsByPlayerId)) {
    if (!Array.isArray(fleet)) continue;
    const ship = fleet.find((entry) => entry?.instanceId === instanceId);
    if (typeof ship?.shipDefId === "string") {
      return ship.shipDefId;
    }
  }

  const voidShipsByPlayerId = state?.gameData?.voidShipsByPlayerId ?? {};
  for (const fleet of Object.values(voidShipsByPlayerId)) {
    if (!Array.isArray(fleet)) continue;
    const ship = fleet.find((entry) => entry?.instanceId === instanceId);
    if (typeof ship?.shipDefId === "string") {
      return ship.shipDefId;
    }
  }

  return null;
}

function isCaptureEvent(event: unknown): event is BattleLogCaptureEvent {
  if (!event || typeof event !== "object") return false;
  const type = (event as { type?: string }).type;
  return typeof type === "string" && type.startsWith("BATTLE_LOG_CAPTURE_");
}

function getEffectEventKind(event: EffectEvent): string {
  return typeof event?.kind === "string" ? event.kind : "";
}

function getMatchedEffectEvents(
  effects: Effect[],
  effectEvents: EffectEvent[],
  kind: string,
): Array<{ effect: Effect; event: EffectEvent }> {
  const effectById = new Map<string, Effect>();
  for (const effect of effects) {
    effectById.set(effect.id, effect);
  }

  const matches: Array<{ effect: Effect; event: EffectEvent }> = [];
  for (const event of effectEvents) {
    if (getEffectEventKind(event) !== kind) continue;
    const effect = effectById.get(event.effectId);
    if (!effect) continue;
    matches.push({ effect, event });
  }
  return matches;
}

function createCurrentTurnCapture(turnNumber: number): BattleLogCurrentTurnCapture {
  return {
    turnNumber,
    diceValue: null,
    buildAtomsByPlayerId: {},
    battleAtomsByPlayerId: {},
  };
}

function getOrCreateBuildAtomsForPlayer(
  capture: BattleLogCurrentTurnCapture,
  playerId: string,
): BuildCaptureAtom[] {
  if (!Array.isArray(capture.buildAtomsByPlayerId[playerId])) {
    capture.buildAtomsByPlayerId[playerId] = [];
  }
  return capture.buildAtomsByPlayerId[playerId];
}

function getOrCreateBattleAtomsForPlayer(
  capture: BattleLogCurrentTurnCapture,
  playerId: string,
): BattleCaptureAtom[] {
  if (!Array.isArray(capture.battleAtomsByPlayerId[playerId])) {
    capture.battleAtomsByPlayerId[playerId] = [];
  }
  return capture.battleAtomsByPlayerId[playerId];
}

function ensureCaptureForTurn(
  store: BattleLogHistoryStore,
  turnNumber: number,
): BattleLogCurrentTurnCapture {
  if (
    !store.currentTurnCapture ||
    store.currentTurnCapture.turnNumber !== turnNumber
  ) {
    store.currentTurnCapture = createCurrentTurnCapture(turnNumber);
  }
  return store.currentTurnCapture;
}

function pushBuildRerollAtom(
  atoms: BuildCaptureAtom[],
  sourceShipDefId: string,
  fromValue: number,
  toValue: number,
) {
  const previous = atoms[atoms.length - 1];
  if (
    previous?.kind === "reroll" &&
    previous.sourceShipDefId === sourceShipDefId &&
    previous.values[previous.values.length - 1] === fromValue
  ) {
    previous.values.push(toValue);
    return;
  }

  atoms.push({
    kind: "reroll",
    sourceShipDefId,
    values: [fromValue, toValue],
  });
}

function formatJoinedShipDefIds(targetShipDefIds: string[]): string {
  if (targetShipDefIds.length <= 0) return "";
  if (targetShipDefIds.length === 1) return targetShipDefIds[0];
  if (targetShipDefIds.length === 2) {
    return `${targetShipDefIds[0]} and ${targetShipDefIds[1]}`;
  }
  const initial = targetShipDefIds.slice(0, -1).join(", ");
  return `${initial}, and ${targetShipDefIds[targetShipDefIds.length - 1]}`;
}

function collapseCountLines<T>(
  items: T[],
  getKey: (item: T) => string,
  renderLine: (item: T, count: number) => string,
): string[] {
  const counts = new Map<string, { item: T; count: number }>();
  const order: string[] = [];

  for (const item of items) {
    const key = getKey(item);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(key, { item, count: 1 });
    order.push(key);
  }

  return order.map((key) => {
    const entry = counts.get(key)!;
    return renderLine(entry.item, entry.count);
  });
}

function formatBuildLines(buildAtoms: BuildCaptureAtom[]): string[] {
  const rerollLines: string[] = [];
  const manualBuilds: Array<Extract<BuildCaptureAtom, { kind: "manual_build" }>> = [];
  const producedBuilds: Array<Extract<BuildCaptureAtom, { kind: "produced_build" }>> = [];

  for (const atom of buildAtoms) {
    if (atom.kind === "reroll") {
      rerollLines.push(
        `${atom.sourceShipDefId} rerolled ${atom.values.join(" -> ")}`,
      );
      continue;
    }
    if (atom.kind === "manual_build") {
      manualBuilds.push(atom);
      continue;
    }
    producedBuilds.push(atom);
  }

  const manualLines = collapseCountLines(
    manualBuilds,
    (atom) => atom.shipDefId,
    (atom, count) => `${count} x ${atom.shipDefId}`,
  );

  const producedLines: string[] = [];
  const producedCounts = new Map<string, number>();
  const producedOrder: string[] = [];
  const producedSamples = new Map<string, Extract<BuildCaptureAtom, { kind: "produced_build" }>>();

  for (const atom of producedBuilds) {
    const key = `${atom.shipDefId}::${atom.sourceShipDefId}`;
    if (!producedCounts.has(key)) {
      producedCounts.set(key, 0);
      producedOrder.push(key);
      producedSamples.set(key, atom);
    }
    producedCounts.set(key, (producedCounts.get(key) ?? 0) + atom.count);
  }

  for (const key of producedOrder) {
    const sample = producedSamples.get(key)!;
    const count = producedCounts.get(key) ?? 0;
    producedLines.push(
      `${count} x ${sample.shipDefId} (${sample.sourceShipDefId})`,
    );
  }

  return [...rerollLines, ...manualLines, ...producedLines];
}

function formatBattleLines(battleAtoms: BattleCaptureAtom[]): string[] {
  const orderedAtoms = [...battleAtoms].sort((left, right) => left.bucket - right.bucket);
  const earlyRows: string[] = [];
  const chargeActionAtoms: Array<Extract<BattleCaptureAtom, { kind: "charge_action" }>> = [];

  for (const atom of orderedAtoms) {
    if (atom.kind === "charge_action") {
      chargeActionAtoms.push(atom);
      continue;
    }

    if (atom.kind === "destroy") {
      if (atom.targetShipDefIds.length === 1) {
        earlyRows.push(
          `${atom.sourceShipDefId} destroys ${atom.targetShipDefIds[0]}`,
        );
      } else if (atom.targetShipDefIds.length > 1) {
        earlyRows.push(
          `${atom.sourceShipDefId} destroyed ${
            formatJoinedShipDefIds(atom.targetShipDefIds)
          }`,
        );
      }
      continue;
    }

    if (atom.targetShipDefIds.length > 0) {
      earlyRows.push(
        `${atom.sourceShipDefId} stole ${
          formatJoinedShipDefIds(atom.targetShipDefIds)
        }`,
      );
    }
  }

  const chargeLines = collapseCountLines(
    chargeActionAtoms,
    (atom) => `${atom.sourceShipDefId}::${atom.actionLabel}`,
    (atom, count) => `${count} x ${atom.sourceShipDefId} ${atom.actionLabel}`,
  );

  return [...earlyRows, ...chargeLines];
}

export function getBattleLogHistoryKey(gameId: string): string {
  return `game_history_${gameId}`;
}

export function createEmptyBattleLogHistoryStore(
  gameId: string,
): BattleLogHistoryStore {
  return {
    gameId,
    revision: 0,
    completedTurnCount: 0,
    turns: [],
    currentTurnCapture: null,
  };
}

export function normalizeBattleLogHistoryStore(
  gameId: string,
  rawStore: unknown,
): BattleLogHistoryStore {
  if (!rawStore || typeof rawStore !== "object") {
    return createEmptyBattleLogHistoryStore(gameId);
  }

  const store = rawStore as Partial<BattleLogHistoryStore>;
  return {
    gameId,
    revision: isFiniteNumber(store.revision) ? store.revision : 0,
    completedTurnCount: isFiniteNumber(store.completedTurnCount)
      ? store.completedTurnCount
      : Array.isArray(store.turns)
        ? store.turns.length
        : 0,
    turns: Array.isArray(store.turns) ? store.turns : [],
    currentTurnCapture:
      store.currentTurnCapture &&
        typeof store.currentTurnCapture === "object" &&
        isFiniteNumber(store.currentTurnCapture.turnNumber)
        ? {
            turnNumber: store.currentTurnCapture.turnNumber,
            diceValue: isFiniteNumber(store.currentTurnCapture.diceValue)
              ? store.currentTurnCapture.diceValue
              : null,
            buildAtomsByPlayerId:
              store.currentTurnCapture.buildAtomsByPlayerId ?? {},
            battleAtomsByPlayerId:
              store.currentTurnCapture.battleAtomsByPlayerId ?? {},
          }
        : null,
  };
}

export function toBattleLogHistoryResponse(
  store: BattleLogHistoryStore,
): BattleLogHistoryResponse {
  return {
    gameId: store.gameId,
    revision: store.revision,
    completedTurnCount: store.completedTurnCount,
    turns: store.turns,
  };
}

export function getBattleLogCaptureTurnNumber(event: unknown): number | null {
  if (!event || typeof event !== "object") return null;

  if ((event as { type?: string }).type === "DICE_ROLLED") {
    const turnNumber = (event as { turnNumber?: number }).turnNumber;
    return isFiniteNumber(turnNumber) ? turnNumber : null;
  }

  if (!isCaptureEvent(event)) return null;
  return isFiniteNumber(event.turnNumber) ? event.turnNumber : null;
}

export function foldBattleLogCaptureEvents(
  store: BattleLogHistoryStore,
  events: unknown[],
): BattleLogHistoryStore {
  const nextStore = normalizeBattleLogHistoryStore(store.gameId, store);

  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") continue;

    if ((rawEvent as { type?: string }).type === "DICE_ROLLED") {
      const turnNumber = getBattleLogCaptureTurnNumber(rawEvent);
      const diceValue = (rawEvent as { value?: number }).value;
      if (turnNumber === null || !isFiniteNumber(diceValue)) continue;
      const capture = ensureCaptureForTurn(nextStore, turnNumber);
      capture.diceValue = diceValue;
      continue;
    }

    if (!isCaptureEvent(rawEvent)) continue;

    const capture = ensureCaptureForTurn(nextStore, rawEvent.turnNumber);

    switch (rawEvent.type) {
      case "BATTLE_LOG_CAPTURE_BUILD_REROLL": {
        const buildAtoms = getOrCreateBuildAtomsForPlayer(
          capture,
          rawEvent.playerId,
        );
        pushBuildRerollAtom(
          buildAtoms,
          rawEvent.sourceShipDefId,
          rawEvent.fromValue,
          rawEvent.toValue,
        );
        break;
      }
      case "BATTLE_LOG_CAPTURE_BUILD_MANUAL":
        getOrCreateBuildAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "manual_build",
          shipDefId: rawEvent.shipDefId,
        });
        break;
      case "BATTLE_LOG_CAPTURE_BUILD_PRODUCED":
        getOrCreateBuildAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "produced_build",
          shipDefId: rawEvent.shipDefId,
          sourceShipDefId: rawEvent.sourceShipDefId,
          count: rawEvent.count,
        });
        break;
      case "BATTLE_LOG_CAPTURE_BATTLE_CHARGE_ACTION":
        getOrCreateBattleAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "charge_action",
          sourceShipDefId: rawEvent.sourceShipDefId,
          actionLabel: rawEvent.actionLabel,
          bucket: 2,
        });
        break;
      case "BATTLE_LOG_CAPTURE_BATTLE_DESTROY":
        getOrCreateBattleAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "destroy",
          sourceShipDefId: rawEvent.sourceShipDefId,
          targetShipDefIds: rawEvent.targetShipDefIds,
          bucket: rawEvent.bucket,
        });
        break;
      case "BATTLE_LOG_CAPTURE_BATTLE_STEAL":
        getOrCreateBattleAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "steal",
          sourceShipDefId: rawEvent.sourceShipDefId,
          targetShipDefIds: rawEvent.targetShipDefIds,
          bucket: rawEvent.bucket,
        });
        break;
    }
  }

  return nextStore;
}

export function detectCompletedBattleTurnFromStateTransition(
  previousState: GameStateLike,
  nextState: GameStateLike,
): number | null {
  const previousTurnNumber = getCurrentTurnNumber(previousState);
  const nextTurnNumber = getCurrentTurnNumber(nextState);
  const previousPhaseKey = getPhaseKeyFromState(previousState);
  const previousStatus = previousState?.status;
  const nextStatus = nextState?.status;

  if (
    previousTurnNumber > 0 &&
    previousStatus !== "finished" &&
    isBattlePhaseKey(previousPhaseKey) &&
    isStartOfNextTurnBuild(nextState, previousTurnNumber)
  ) {
    return previousTurnNumber;
  }

  const resultReason = nextState?.resultReason;
  const isBattleTerminalReason =
    resultReason === "decisive" ||
    resultReason === "narrow" ||
    resultReason === "mutual_destruction";

  if (
    previousTurnNumber > 0 &&
    isBattlePhaseKey(previousPhaseKey) &&
    previousStatus !== "finished" &&
    nextStatus === "finished" &&
    isBattleTerminalReason &&
    nextTurnNumber === previousTurnNumber
  ) {
    return nextTurnNumber;
  }

  return null;
}

export function finalizeBattleLogTurn(
  store: BattleLogHistoryStore,
  finalizedTurnNumber: number,
  finalizedState: GameStateLike,
): BattleLogHistoryStore {
  const nextStore = normalizeBattleLogHistoryStore(store.gameId, store);
  const latestTurn = nextStore.turns[nextStore.turns.length - 1];

  if (latestTurn?.turnNumber === finalizedTurnNumber) {
    if (
      nextStore.currentTurnCapture?.turnNumber === finalizedTurnNumber
    ) {
      nextStore.currentTurnCapture = null;
    }
    return nextStore;
  }

  const capture =
    nextStore.currentTurnCapture?.turnNumber === finalizedTurnNumber
      ? nextStore.currentTurnCapture
      : null;

  const activePlayers = getActivePlayers(finalizedState);
  const lastTurnNetByPlayerId = finalizedState?.gameData?.lastTurnNetByPlayerId ?? {};

  const buildLinesByPlayerId: Record<string, string[]> = {};
  const battleLinesByPlayerId: Record<string, string[]> = {};

  for (const player of activePlayers) {
    const buildAtoms = capture?.buildAtomsByPlayerId?.[player.id] ?? [];
    const battleAtoms = capture?.battleAtomsByPlayerId?.[player.id] ?? [];
    buildLinesByPlayerId[player.id] = formatBuildLines(buildAtoms);
    battleLinesByPlayerId[player.id] = formatBattleLines(battleAtoms);
  }

  const summary: BattleLogTurnSummary = {
    turnNumber: finalizedTurnNumber,
    diceValue: capture?.diceValue ?? null,
    players: activePlayers.map((player) => ({
      playerId: player.id,
      name: typeof player.name === "string" ? player.name : player.id,
      healthEnd: isFiniteNumber(player.health) ? player.health : 0,
      healthDelta: isFiniteNumber(lastTurnNetByPlayerId[player.id])
        ? lastTurnNetByPlayerId[player.id]
        : 0,
    })),
    buildLinesByPlayerId,
    battleLinesByPlayerId,
  };

  nextStore.turns = [...nextStore.turns, summary];
  nextStore.completedTurnCount = nextStore.turns.length;
  nextStore.revision += 1;

  if (nextStore.currentTurnCapture?.turnNumber === finalizedTurnNumber) {
    nextStore.currentTurnCapture = null;
  }

  return nextStore;
}

export function createBattleLogBuildManualCaptureEvent(args: {
  turnNumber: number;
  playerId: string;
  shipDefId: string;
}): BattleLogCaptureEvent {
  return {
    type: "BATTLE_LOG_CAPTURE_BUILD_MANUAL",
    ...args,
  };
}

export function createBattleLogBuildProducedCaptureEvent(args: {
  turnNumber: number;
  playerId: string;
  shipDefId: string;
  sourceShipDefId: string;
  count?: number;
}): BattleLogCaptureEvent {
  return {
    type: "BATTLE_LOG_CAPTURE_BUILD_PRODUCED",
    turnNumber: args.turnNumber,
    playerId: args.playerId,
    shipDefId: args.shipDefId,
    sourceShipDefId: args.sourceShipDefId,
    count: isFiniteNumber(args.count) && args.count > 0 ? args.count : 1,
  };
}

export function createBattleLogBuildRerollCaptureEvents(args: {
  turnNumber: number;
  baseValueBeforeReroll: number;
  rerollingPlayerIds: string[];
  newValue: number;
}): BattleLogCaptureEvent[] {
  const events: BattleLogCaptureEvent[] = [];
  for (const playerId of args.rerollingPlayerIds) {
    events.push({
      type: "BATTLE_LOG_CAPTURE_BUILD_REROLL",
      turnNumber: args.turnNumber,
      playerId,
      sourceShipDefId: "KNO",
      fromValue: args.baseValueBeforeReroll,
      toValue: args.newValue,
    });
  }
  return events;
}

export function createBattleLogBuildCaptureEventsFromResolution(
  args: CaptureResolutionArgs,
): BattleLogCaptureEvent[] {
  const createShipMatches = getMatchedEffectEvents(
    args.effects,
    args.effectEvents,
    "CreateShip",
  );
  const destroyMatches = getMatchedEffectEvents(
    args.effects,
    args.effectEvents,
    "DestroyShip",
  );
  const events: BattleLogCaptureEvent[] = [];

  for (const match of createShipMatches) {
    if (match.effect.source.type !== "ship") continue;
    const shipDefId = match.event.details?.shipDefId;
    if (typeof shipDefId !== "string") continue;
    events.push(
      createBattleLogBuildProducedCaptureEvent({
        turnNumber: args.turnNumber,
        playerId: args.playerId,
        shipDefId,
        sourceShipDefId: match.effect.source.shipDefId,
        count: 1,
      }),
    );
  }

  for (const match of destroyMatches) {
    if (match.effect.source.type !== "ship") continue;
    const createdShipsFromDestroy = match.event.details?.createdShipsFromDestroy;
    if (!isFiniteNumber(createdShipsFromDestroy) || createdShipsFromDestroy <= 0) {
      continue;
    }
    events.push(
      createBattleLogBuildProducedCaptureEvent({
        turnNumber: args.turnNumber,
        playerId: args.playerId,
        shipDefId: "XEN",
        sourceShipDefId: match.effect.source.shipDefId,
        count: createdShipsFromDestroy,
      }),
    );
  }

  return events;
}

export function createBattleLogBattleCaptureEventsFromResolution(args: {
  stateBeforeResolution: GameStateLike;
  turnNumber: number;
  playerId: string;
  phaseKey: string;
  choiceId: string;
  effects: Effect[];
  effectEvents: EffectEvent[];
}): BattleLogCaptureEvent[] {
  const transferMatches = getMatchedEffectEvents(
    args.effects,
    args.effectEvents,
    "TransferShip",
  );
  const destroyMatches = getMatchedEffectEvents(
    args.effects,
    args.effectEvents,
    "DestroyShip",
  );
  const bucket: 1 | 2 = args.phaseKey === "battle.first_strike" ? 1 : 2;
  const captureEvents: BattleLogCaptureEvent[] = [];

  for (const match of transferMatches) {
    if (match.effect.source.type !== "ship") continue;
    const shipInstanceIds = Array.isArray(match.event.details?.shipInstanceIds)
      ? match.event.details.shipInstanceIds
      : [];
    const targetShipDefIds = shipInstanceIds
      .map((instanceId: string) =>
        getShipDefIdByInstanceId(args.stateBeforeResolution, instanceId),
      )
      .filter((shipDefId: string | null): shipDefId is string =>
        typeof shipDefId === "string"
      );

    if (targetShipDefIds.length <= 0) continue;

    captureEvents.push({
      type: "BATTLE_LOG_CAPTURE_BATTLE_STEAL",
      turnNumber: args.turnNumber,
      playerId: args.playerId,
      sourceShipDefId: match.effect.source.shipDefId,
      targetShipDefIds,
      bucket,
    });
  }

  const destroyTargetsBySource = new Map<string, string[]>();
  for (const match of destroyMatches) {
    if (match.effect.source.type !== "ship") continue;
    const shipInstanceId = match.event.details?.shipInstanceId;
    if (typeof shipInstanceId !== "string") continue;
    const targetShipDefId = getShipDefIdByInstanceId(
      args.stateBeforeResolution,
      shipInstanceId,
    );
    if (!targetShipDefId) continue;

    const sourceShipDefId = match.effect.source.shipDefId;
    const existing = destroyTargetsBySource.get(sourceShipDefId) ?? [];
    existing.push(targetShipDefId);
    destroyTargetsBySource.set(sourceShipDefId, existing);
  }

  for (const [sourceShipDefId, targetShipDefIds] of destroyTargetsBySource) {
    if (targetShipDefIds.length <= 0) continue;
    captureEvents.push({
      type: "BATTLE_LOG_CAPTURE_BATTLE_DESTROY",
      turnNumber: args.turnNumber,
      playerId: args.playerId,
      sourceShipDefId,
      targetShipDefIds,
      bucket,
    });
  }

  if (captureEvents.length > 0) {
    return captureEvents;
  }

  const sourceEffect = args.effects.find((effect) => effect.source.type === "ship");
  const sourceShipDefId = sourceEffect?.source.type === "ship"
    ? sourceEffect.source.shipDefId
    : null;
  if (!sourceShipDefId) {
    return [];
  }

  const normalizedChoiceId = args.choiceId === "heal"
    ? "Heal"
    : args.choiceId === "damage"
      ? "Damage"
      : null;

  if (
    (args.phaseKey === "battle.charge_declaration" ||
      args.phaseKey === "battle.charge_response") &&
    normalizedChoiceId
  ) {
    const hasMatchingEffect = args.effects.some((effect) =>
      normalizedChoiceId === "Heal"
        ? effect.kind === "Heal"
        : effect.kind === "Damage"
    );

    if (hasMatchingEffect) {
      return [{
        type: "BATTLE_LOG_CAPTURE_BATTLE_CHARGE_ACTION",
        turnNumber: args.turnNumber,
        playerId: args.playerId,
        sourceShipDefId,
        actionLabel: normalizedChoiceId,
      }];
    }
  }

  return [];
}
