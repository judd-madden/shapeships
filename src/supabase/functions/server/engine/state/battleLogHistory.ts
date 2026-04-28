import type { EffectEvent } from "../../engine_shared/effects/applyEffects.ts";
import { EffectKind, type Effect } from "../../engine_shared/effects/Effect.ts";
import { debugLog } from "../../utils/serverLogger.ts";

export type BattleLogHistoryResponse = {
  gameId: string;
  revision: number;
  completedTurnCount: number;
  turns: BattleLogTurnSummary[];
};

export type BattleLogAnalysisBreakdownRow = {
  label: string;
  amount: number;
  count?: number;
  rowKind?: "ship" | "adjustment";
};

export type BattleLogTurnPlayerAnalysis = {
  damageTaken: number;
  healReceived: number;
  netHealthDelta: number;
  savedLinesEnd: number;
  savedJoiningLinesEnd: number;
  damageDealtBreakdown?: BattleLogAnalysisBreakdownRow[];
  healingReceivedBreakdown?: BattleLogAnalysisBreakdownRow[];
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
  analysisByPlayerId?: Record<string, BattleLogTurnPlayerAnalysis>;
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
    }
  | {
      kind: "frigate_hit";
      bucket: 2;
    };

export type BattleLogCurrentTurnCapture = {
  turnNumber: number;
  diceValue: number | null;
  buildAtomsByPlayerId: Record<string, BuildCaptureAtom[]>;
  battleAtomsByPlayerId: Record<string, BattleCaptureAtom[]>;
  savedResourcesByPlayerId: Record<
    string,
    { ordinaryLines: number; joiningLines: number }
  >;
};

export type BattleLogScratch = {
  currentTurnCapture: BattleLogCurrentTurnCapture | null;
  lastFinalizedTurnNumber?: number | null;
};

export type BattleLogFinalizeTurnReason =
  | "turn_bump"
  | "terminal_victory";

export type BattleLogFinalizeTurnEvent = {
  type: "BATTLE_LOG_FINALIZE_TURN";
  finalizedTurnNumber: number;
  terminal: boolean;
  nextTurnNumber?: number;
  reason?: BattleLogFinalizeTurnReason;
  atMs?: number;
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
    }
  | {
      type: "BATTLE_LOG_CAPTURE_BATTLE_FRIGATE_HIT";
      turnNumber: number;
      playerId: string;
    };

export type BattleLogHistoryStore = {
  gameId: string;
  revision: number;
  completedTurnCount: number;
  turns: BattleLogTurnSummary[];
  /**
   * Legacy-only compatibility field.
   * New writes should keep mutable capture in top-level state.battleLogScratch.
   */
  currentTurnCapture: BattleLogCurrentTurnCapture | null;
};

type BattleLogCaptureHolder = {
  currentTurnCapture: BattleLogCurrentTurnCapture | null;
};

type PlayerWithState = {
  id: string;
  name?: string;
  role?: string;
  health?: number;
  lines?: number;
  joiningLines?: number;
};

type GameStateLike = {
  status?: string;
  resultReason?: string | null;
  battleLogScratch?: unknown;
  players?: PlayerWithState[];
  gameData?: {
    turnNumber?: number;
    currentPhase?: string;
    currentSubPhase?: string;
    lastTurnDamageByPlayerId?: Record<string, number>;
    lastTurnHealByPlayerId?: Record<string, number>;
    lastTurnNetByPlayerId?: Record<string, number>;
    lastTurnDamageDealtBreakdownByPlayerId?: Record<string, unknown>;
    lastTurnHealingReceivedBreakdownByPlayerId?: Record<string, unknown>;
    ships?: Record<string, Array<{ instanceId?: string; shipDefId?: string }>>;
    voidShipsByPlayerId?: Record<
      string,
      Array<{ instanceId?: string; shipDefId?: string }>
    >;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type AuthoritativeBreakdownRowLike = {
  label?: unknown;
  amount?: unknown;
  count?: unknown;
  rowKind?: unknown;
};

function cloneBattleLogAnalysisBreakdownRow(
  row: BattleLogAnalysisBreakdownRow,
): BattleLogAnalysisBreakdownRow {
  return {
    label: row.label,
    amount: row.amount,
    count: isFiniteNumber(row.count) ? row.count : undefined,
    rowKind: row.rowKind,
  };
}

function normalizeBattleLogAnalysisBreakdownRow(
  rawRow: unknown,
): BattleLogAnalysisBreakdownRow | null {
  if (!rawRow || typeof rawRow !== "object") {
    return null;
  }

  const row = rawRow as AuthoritativeBreakdownRowLike;
  const label = isNonEmptyString(row.label) ? row.label.trim() : "";
  const amount = isFiniteNumber(row.amount) ? row.amount : 0;

  if (!label || amount === 0) {
    return null;
  }

  const count = isFiniteNumber(row.count) && row.count > 0
    ? Math.floor(row.count)
    : undefined;
  const rowKind = row.rowKind === "adjustment" ? "adjustment" : "ship";

  return {
    label,
    amount,
    count,
    rowKind,
  };
}

function groupBattleLogAnalysisBreakdownRows(
  rawRows: unknown,
): BattleLogAnalysisBreakdownRow[] | undefined {
  if (!Array.isArray(rawRows)) {
    return undefined;
  }

  const groupedRows = new Map<string, BattleLogAnalysisBreakdownRow>();

  for (const rawRow of rawRows) {
    const normalizedRow = normalizeBattleLogAnalysisBreakdownRow(rawRow);
    if (!normalizedRow) continue;

    const existing = groupedRows.get(normalizedRow.label);
    if (!existing) {
      groupedRows.set(normalizedRow.label, normalizedRow);
      continue;
    }

    existing.amount += normalizedRow.amount;
    if (existing.rowKind === "ship" && normalizedRow.rowKind === "ship") {
      const existingCount = existing.count ?? 0;
      const nextCount = normalizedRow.count ?? 0;
      const totalCount = existingCount + nextCount;
      existing.count = totalCount > 0 ? totalCount : undefined;
    }
  }

  const rows = [...groupedRows.values()].filter((row) => row.amount !== 0);
  if (rows.length <= 0) {
    return undefined;
  }

  return rows.map(cloneBattleLogAnalysisBreakdownRow);
}

function cloneBattleLogTurnPlayerAnalysis(
  analysis: BattleLogTurnPlayerAnalysis,
): BattleLogTurnPlayerAnalysis {
  return {
    damageTaken: analysis.damageTaken,
    healReceived: analysis.healReceived,
    netHealthDelta: analysis.netHealthDelta,
    savedLinesEnd: analysis.savedLinesEnd,
    savedJoiningLinesEnd: analysis.savedJoiningLinesEnd,
    damageDealtBreakdown: analysis.damageDealtBreakdown?.map(
      cloneBattleLogAnalysisBreakdownRow,
    ),
    healingReceivedBreakdown: analysis.healingReceivedBreakdown?.map(
      cloneBattleLogAnalysisBreakdownRow,
    ),
  };
}

function normalizeBattleLogTurnPlayerAnalysis(
  rawAnalysis: unknown,
): BattleLogTurnPlayerAnalysis | null {
  if (!rawAnalysis || typeof rawAnalysis !== "object") {
    return null;
  }

  const analysis = rawAnalysis as Partial<BattleLogTurnPlayerAnalysis>;
  if (
    !isFiniteNumber(analysis.damageTaken) ||
    !isFiniteNumber(analysis.healReceived) ||
    !isFiniteNumber(analysis.netHealthDelta) ||
    !isFiniteNumber(analysis.savedLinesEnd) ||
    !isFiniteNumber(analysis.savedJoiningLinesEnd)
  ) {
    return null;
  }

  const normalized: BattleLogTurnPlayerAnalysis = {
    damageTaken: analysis.damageTaken,
    healReceived: analysis.healReceived,
    netHealthDelta: analysis.netHealthDelta,
    savedLinesEnd: analysis.savedLinesEnd,
    savedJoiningLinesEnd: analysis.savedJoiningLinesEnd,
  };

  const damageDealtBreakdown = groupBattleLogAnalysisBreakdownRows(
    analysis.damageDealtBreakdown,
  );
  if (damageDealtBreakdown) {
    normalized.damageDealtBreakdown = damageDealtBreakdown;
  }

  const healingReceivedBreakdown = groupBattleLogAnalysisBreakdownRows(
    analysis.healingReceivedBreakdown,
  );
  if (healingReceivedBreakdown) {
    normalized.healingReceivedBreakdown = healingReceivedBreakdown;
  }

  return normalized;
}

function normalizeBattleLogAnalysisByPlayerId(
  rawValue: unknown,
): Record<string, BattleLogTurnPlayerAnalysis> | undefined {
  if (!rawValue || typeof rawValue !== "object") {
    return undefined;
  }

  const next: Record<string, BattleLogTurnPlayerAnalysis> = {};

  for (const [playerId, rawAnalysis] of Object.entries(
    rawValue as Record<string, unknown>,
  )) {
    const normalizedAnalysis = normalizeBattleLogTurnPlayerAnalysis(rawAnalysis);
    if (!normalizedAnalysis) continue;
    next[playerId] = normalizedAnalysis;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function cloneBuildCaptureAtom(atom: BuildCaptureAtom): BuildCaptureAtom {
  if (atom.kind === "reroll") {
    return {
      kind: "reroll",
      sourceShipDefId: atom.sourceShipDefId,
      values: [...atom.values],
    };
  }

  if (atom.kind === "manual_build") {
    return {
      kind: "manual_build",
      shipDefId: atom.shipDefId,
    };
  }

  return {
    kind: "produced_build",
    shipDefId: atom.shipDefId,
    sourceShipDefId: atom.sourceShipDefId,
    count: atom.count,
  };
}

function cloneBattleCaptureAtom(atom: BattleCaptureAtom): BattleCaptureAtom {
  if (atom.kind === "charge_action") {
    return {
      kind: "charge_action",
      sourceShipDefId: atom.sourceShipDefId,
      actionLabel: atom.actionLabel,
      bucket: atom.bucket,
    };
  }

  if (atom.kind === "destroy") {
    return {
      kind: "destroy",
      sourceShipDefId: atom.sourceShipDefId,
      targetShipDefIds: [...atom.targetShipDefIds],
      bucket: atom.bucket,
    };
  }

  if (atom.kind === "steal") {
    return {
      kind: "steal",
      sourceShipDefId: atom.sourceShipDefId,
      targetShipDefIds: [...atom.targetShipDefIds],
      bucket: atom.bucket,
    };
  }

  return {
    kind: "frigate_hit",
    bucket: atom.bucket,
  };
}

function normalizeBuildAtomsByPlayerId(
  rawValue: unknown,
): Record<string, BuildCaptureAtom[]> {
  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  const next: Record<string, BuildCaptureAtom[]> = {};
  for (const [playerId, rawAtoms] of Object.entries(
    rawValue as Record<string, unknown>,
  )) {
    if (!Array.isArray(rawAtoms)) continue;
    next[playerId] = rawAtoms
      .filter((atom): atom is BuildCaptureAtom => {
        if (!atom || typeof atom !== "object") return false;
        const kind = (atom as { kind?: string }).kind;
        if (kind === "reroll") {
          return (
            typeof (atom as { sourceShipDefId?: unknown }).sourceShipDefId ===
              "string" &&
            Array.isArray((atom as { values?: unknown }).values)
          );
        }
        if (kind === "manual_build") {
          return typeof (atom as { shipDefId?: unknown }).shipDefId === "string";
        }
        if (kind === "produced_build") {
          return (
            typeof (atom as { shipDefId?: unknown }).shipDefId === "string" &&
            typeof (atom as { sourceShipDefId?: unknown }).sourceShipDefId ===
              "string" &&
            isFiniteNumber((atom as { count?: unknown }).count)
          );
        }
        return false;
      })
      .map(cloneBuildCaptureAtom);
  }

  return next;
}

function normalizeBattleAtomsByPlayerId(
  rawValue: unknown,
): Record<string, BattleCaptureAtom[]> {
  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  const next: Record<string, BattleCaptureAtom[]> = {};
  for (const [playerId, rawAtoms] of Object.entries(
    rawValue as Record<string, unknown>,
  )) {
    if (!Array.isArray(rawAtoms)) continue;
    next[playerId] = rawAtoms
      .filter((atom): atom is BattleCaptureAtom => {
        if (!atom || typeof atom !== "object") return false;
        const kind = (atom as { kind?: string }).kind;
        if (kind === "charge_action") {
          return (
            typeof (atom as { sourceShipDefId?: unknown }).sourceShipDefId ===
              "string" &&
            ((atom as { actionLabel?: unknown }).actionLabel === "Heal" ||
              (atom as { actionLabel?: unknown }).actionLabel === "Damage") &&
            ((atom as { bucket?: unknown }).bucket === 2)
          );
        }
        if (kind === "destroy" || kind === "steal") {
          return (
            typeof (atom as { sourceShipDefId?: unknown }).sourceShipDefId ===
              "string" &&
            Array.isArray((atom as { targetShipDefIds?: unknown }).targetShipDefIds) &&
            (((atom as { bucket?: unknown }).bucket === 1) ||
              ((atom as { bucket?: unknown }).bucket === 2))
          );
        }
        if (kind === "frigate_hit") {
          return (atom as { bucket?: unknown }).bucket === 2;
        }
        return false;
      })
      .map(cloneBattleCaptureAtom);
  }

  return next;
}

function normalizeBattleLogCurrentTurnCapture(
  rawCapture: unknown,
): BattleLogCurrentTurnCapture | null {
  if (!rawCapture || typeof rawCapture !== "object") {
    return null;
  }

  const capture = rawCapture as Partial<BattleLogCurrentTurnCapture>;
  if (!isFiniteNumber(capture.turnNumber)) {
    return null;
  }

  return {
    turnNumber: capture.turnNumber,
    diceValue: isFiniteNumber(capture.diceValue) ? capture.diceValue : null,
    buildAtomsByPlayerId: normalizeBuildAtomsByPlayerId(
      capture.buildAtomsByPlayerId,
    ),
    battleAtomsByPlayerId: normalizeBattleAtomsByPlayerId(
      capture.battleAtomsByPlayerId,
    ),
    savedResourcesByPlayerId: Object.fromEntries(
      Object.entries(
        capture.savedResourcesByPlayerId as Record<string, unknown> ?? {},
      ).flatMap(([playerId, rawResources]) => {
        if (!rawResources || typeof rawResources !== "object") {
          return [];
        }

        const resources = rawResources as {
          ordinaryLines?: unknown;
          joiningLines?: unknown;
        };
        if (
          !isFiniteNumber(resources.ordinaryLines) ||
          !isFiniteNumber(resources.joiningLines)
        ) {
          return [];
        }

        return [[playerId, {
          ordinaryLines: resources.ordinaryLines,
          joiningLines: resources.joiningLines,
        }] as const];
      }),
    ),
  };
}

function cloneBattleLogTurnSummary(
  summary: BattleLogTurnSummary,
): BattleLogTurnSummary {
  const normalizedAnalysisByPlayerId = normalizeBattleLogAnalysisByPlayerId(
    summary.analysisByPlayerId,
  );

  return {
    turnNumber: summary.turnNumber,
    diceValue: summary.diceValue,
    players: summary.players.map((player) => ({
      playerId: player.playerId,
      name: player.name,
      healthEnd: player.healthEnd,
      healthDelta: player.healthDelta,
    })),
    buildLinesByPlayerId: Object.fromEntries(
      Object.entries(summary.buildLinesByPlayerId).map(([playerId, lines]) => [
        playerId,
        [...lines],
      ]),
    ),
    battleLinesByPlayerId: Object.fromEntries(
      Object.entries(summary.battleLinesByPlayerId).map(([playerId, lines]) => [
        playerId,
        [...lines],
      ]),
    ),
    analysisByPlayerId: normalizedAnalysisByPlayerId
      ? Object.fromEntries(
          Object.entries(normalizedAnalysisByPlayerId).map((
            [playerId, analysis],
          ) => [playerId, cloneBattleLogTurnPlayerAnalysis(analysis)]),
        )
      : undefined,
  };
}

function createCurrentTurnCapture(
  turnNumber: number,
): BattleLogCurrentTurnCapture {
  return {
    turnNumber,
    diceValue: null,
    buildAtomsByPlayerId: {},
    battleAtomsByPlayerId: {},
    savedResourcesByPlayerId: {},
  };
}

function getSavedResourcesSnapshotForTurn(args: {
  capture: BattleLogCurrentTurnCapture | null;
  finalizedTurnNumber: number;
  finalizedState: GameStateLike;
  playerId: string;
  fallbackPlayer: PlayerWithState;
}): { ordinaryLines: number; joiningLines: number } {
  const { capture, finalizedTurnNumber, finalizedState, playerId, fallbackPlayer } =
    args;
  const finalizedStateTurnNumber = getCurrentTurnNumber(finalizedState);
  const captureSavedResources = capture?.savedResourcesByPlayerId?.[playerId];
  const isTurnBumpFinalization =
    finalizedStateTurnNumber === finalizedTurnNumber + 1;

  if (
    isTurnBumpFinalization &&
    captureSavedResources &&
    isFiniteNumber(captureSavedResources.ordinaryLines) &&
    isFiniteNumber(captureSavedResources.joiningLines)
  ) {
    return {
      ordinaryLines: captureSavedResources.ordinaryLines,
      joiningLines: captureSavedResources.joiningLines,
    };
  }

  return {
    ordinaryLines: isFiniteNumber(fallbackPlayer.lines) ? fallbackPlayer.lines : 0,
    joiningLines: isFiniteNumber(fallbackPlayer.joiningLines)
      ? fallbackPlayer.joiningLines
      : 0,
  };
}

function getTurnNumberForPersistedSavedResources(
  scratch: BattleLogScratch,
): number | null {
  const currentCaptureTurnNumber = scratch.currentTurnCapture?.turnNumber;
  if (isFiniteNumber(currentCaptureTurnNumber)) {
    return currentCaptureTurnNumber;
  }

  const lastFinalizedTurnNumber = scratch.lastFinalizedTurnNumber;
  if (isFiniteNumber(lastFinalizedTurnNumber)) {
    return lastFinalizedTurnNumber + 1;
  }

  return null;
}

function getLatestTurnNumberFromHistoryStore(
  store: BattleLogHistoryStore,
): number | null {
  const latestTurn = store.turns[store.turns.length - 1];
  return isFiniteNumber(latestTurn?.turnNumber) ? latestTurn.turnNumber : null;
}

function getCurrentTurnNumber(state: GameStateLike | null | undefined): number {
  return state?.gameData?.turnNumber ?? 0;
}

function getPhaseKeyFromState(
  state: GameStateLike | null | undefined,
): string | null {
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
  const phaseKey = getPhaseKeyFromState(state);
  return (
    getCurrentTurnNumber(state) === previousTurnNumber + 1 &&
    typeof phaseKey === "string" &&
    phaseKey.startsWith("build.")
  );
}

function getActivePlayers(
  state: GameStateLike | null | undefined,
): PlayerWithState[] {
  return Array.isArray(state?.players)
    ? state.players.filter((player) => player?.role === "player")
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

export function isBattleLogFinalizeTurnEvent(
  event: unknown,
): event is BattleLogFinalizeTurnEvent {
  if (!event || typeof event !== "object") return false;
  const candidate = event as Partial<BattleLogFinalizeTurnEvent>;
  return (
    candidate.type === "BATTLE_LOG_FINALIZE_TURN" &&
    isFiniteNumber(candidate.finalizedTurnNumber) &&
    typeof candidate.terminal === "boolean"
  );
}

export function createBattleLogFinalizeTurnEvent(args: {
  finalizedTurnNumber: number;
  terminal: boolean;
  nextTurnNumber?: number;
  reason?: BattleLogFinalizeTurnReason;
  atMs?: number;
}): BattleLogFinalizeTurnEvent {
  return {
    type: "BATTLE_LOG_FINALIZE_TURN",
    finalizedTurnNumber: args.finalizedTurnNumber,
    terminal: args.terminal,
    nextTurnNumber: isFiniteNumber(args.nextTurnNumber)
      ? args.nextTurnNumber
      : undefined,
    reason: args.reason,
    atMs: isFiniteNumber(args.atMs) ? args.atMs : undefined,
  };
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
  holder: BattleLogCaptureHolder,
  turnNumber: number,
): BattleLogCurrentTurnCapture {
  if (
    !holder.currentTurnCapture ||
    holder.currentTurnCapture.turnNumber !== turnNumber
  ) {
    holder.currentTurnCapture = createCurrentTurnCapture(turnNumber);
  }

  return holder.currentTurnCapture;
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
  const manualBuilds: Array<
    Extract<BuildCaptureAtom, { kind: "manual_build" }>
  > = [];
  const producedBuilds: Array<
    Extract<BuildCaptureAtom, { kind: "produced_build" }>
  > = [];

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
  const producedSamples = new Map<
    string,
    Extract<BuildCaptureAtom, { kind: "produced_build" }>
  >();

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
  const orderedAtoms = [...battleAtoms].sort((left, right) =>
    left.bucket - right.bucket
  );
  const earlyRows: string[] = [];
  const chargeActionAtoms: Array<
    Extract<BattleCaptureAtom, { kind: "charge_action" }>
  > = [];
  const frigateHitAtoms: Array<
    Extract<BattleCaptureAtom, { kind: "frigate_hit" }>
  > = [];

  for (const atom of orderedAtoms) {
    if (atom.kind === "charge_action") {
      chargeActionAtoms.push(atom);
      continue;
    }

    if (atom.kind === "frigate_hit") {
      frigateHitAtoms.push(atom);
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

  const frigateHitLines = collapseCountLines(
    frigateHitAtoms,
    () => "FRI::Hit",
    (_atom, count) => `${count} x FRI Hit`,
  );

  return [...earlyRows, ...chargeLines, ...frigateHitLines];
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

export function createEmptyBattleLogScratch(): BattleLogScratch {
  return {
    currentTurnCapture: null,
    lastFinalizedTurnNumber: null,
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
  const turns = Array.isArray(store.turns)
    ? store.turns
        .filter((summary): summary is BattleLogTurnSummary =>
          !!summary &&
          typeof summary === "object" &&
          isFiniteNumber((summary as { turnNumber?: unknown }).turnNumber)
        )
        .map(cloneBattleLogTurnSummary)
    : [];

  return {
    gameId,
    revision: isFiniteNumber(store.revision) ? store.revision : 0,
    completedTurnCount: isFiniteNumber(store.completedTurnCount)
      ? store.completedTurnCount
      : turns.length,
    turns,
    currentTurnCapture: normalizeBattleLogCurrentTurnCapture(
      store.currentTurnCapture,
    ),
  };
}

export function normalizeBattleLogScratch(
  rawScratch: unknown,
): BattleLogScratch {
  if (!rawScratch || typeof rawScratch !== "object") {
    return createEmptyBattleLogScratch();
  }

  const scratch = rawScratch as Partial<BattleLogScratch>;
  return {
    currentTurnCapture: normalizeBattleLogCurrentTurnCapture(
      scratch.currentTurnCapture,
    ),
    lastFinalizedTurnNumber: isFiniteNumber(scratch.lastFinalizedTurnNumber)
      ? scratch.lastFinalizedTurnNumber
      : null,
  };
}

export function getBattleLogScratchFromState(
  state: GameStateLike | null | undefined,
): BattleLogScratch {
  return normalizeBattleLogScratch(state?.battleLogScratch);
}

export function createBattleLogScratchFromLegacyHistoryStore(
  store: BattleLogHistoryStore,
): BattleLogScratch | null {
  if (!store.currentTurnCapture) {
    return null;
  }

  return {
    currentTurnCapture: normalizeBattleLogCurrentTurnCapture(
      store.currentTurnCapture,
    ),
    lastFinalizedTurnNumber: getLatestTurnNumberFromHistoryStore(store),
  };
}

export function clearBattleLogScratchAfterFinalization(
  scratch: BattleLogScratch,
  finalizedTurnNumber: number,
): BattleLogScratch {
  const normalizedScratch = normalizeBattleLogScratch(scratch);
  const priorFinalizedTurnNumber = normalizedScratch.lastFinalizedTurnNumber;

  return {
    currentTurnCapture: null,
    lastFinalizedTurnNumber:
      isFiniteNumber(priorFinalizedTurnNumber) &&
        priorFinalizedTurnNumber > finalizedTurnNumber
        ? priorFinalizedTurnNumber
        : finalizedTurnNumber,
  };
}

export function toBattleLogHistoryResponse(
  store: BattleLogHistoryStore,
): BattleLogHistoryResponse {
  return {
    gameId: store.gameId,
    revision: store.revision,
    completedTurnCount: store.completedTurnCount,
    turns: store.turns.map(cloneBattleLogTurnSummary),
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

export function selectBattleLogFinalizeTurnEvent(events: unknown[]): {
  event: BattleLogFinalizeTurnEvent | null;
  candidates: BattleLogFinalizeTurnEvent[];
  distinctTurnNumbers: number[];
} {
  const candidates = events.filter(isBattleLogFinalizeTurnEvent);
  if (candidates.length <= 0) {
    return {
      event: null,
      candidates: [],
      distinctTurnNumbers: [],
    };
  }

  const deduped = new Map<string, BattleLogFinalizeTurnEvent>();
  for (const candidate of candidates) {
    const key = [
      candidate.finalizedTurnNumber,
      candidate.terminal ? "terminal" : "non_terminal",
      candidate.nextTurnNumber ?? "none",
      candidate.reason ?? "none",
    ].join(":");
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  const uniqueCandidates = [...deduped.values()];
  const distinctTurnNumbers = [...new Set(
    uniqueCandidates.map((candidate) => candidate.finalizedTurnNumber),
  )].sort((left, right) => left - right);

  const selectedEvent = [...uniqueCandidates].sort((left, right) => {
    if (left.terminal !== right.terminal) {
      return left.terminal ? -1 : 1;
    }
    return right.finalizedTurnNumber - left.finalizedTurnNumber;
  })[0] ?? null;

  return {
    event: selectedEvent,
    candidates: uniqueCandidates,
    distinctTurnNumbers,
  };
}

export function partitionBattleLogCaptureEventsByFinalizedTurn(
  events: unknown[],
  finalizedTurnNumber: number,
): {
  finalizedTurnEvents: unknown[];
  laterTurnEvents: unknown[];
  earlierTurnEvents: unknown[];
} {
  const finalizedTurnEvents: unknown[] = [];
  const laterTurnEvents: unknown[] = [];
  const earlierTurnEvents: unknown[] = [];

  for (const event of events) {
    if (
      event &&
      typeof event === "object" &&
      (event as { type?: string }).type === "BUILD_RESOURCES_PERSISTED"
    ) {
      finalizedTurnEvents.push(event);
      continue;
    }

    const turnNumber = getBattleLogCaptureTurnNumber(event);
    if (turnNumber === null) continue;

    if (turnNumber === finalizedTurnNumber) {
      finalizedTurnEvents.push(event);
      continue;
    }

    if (turnNumber > finalizedTurnNumber) {
      laterTurnEvents.push(event);
      continue;
    }

    earlierTurnEvents.push(event);
  }

  return {
    finalizedTurnEvents,
    laterTurnEvents,
    earlierTurnEvents,
  };
}

export function foldBattleLogCaptureEventsIntoScratch(
  scratch: BattleLogScratch,
  events: unknown[],
): BattleLogScratch {
  const nextScratch = normalizeBattleLogScratch(scratch);

  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") continue;

    if ((rawEvent as { type?: string }).type === "DICE_ROLLED") {
      const turnNumber = getBattleLogCaptureTurnNumber(rawEvent);
      const diceValue = (rawEvent as { value?: number }).value;
      if (turnNumber === null || !isFiniteNumber(diceValue)) continue;
      const capture = ensureCaptureForTurn(nextScratch, turnNumber);
      capture.diceValue = diceValue;
      continue;
    }

    if ((rawEvent as { type?: string }).type === "BUILD_RESOURCES_PERSISTED") {
      const turnNumber = getTurnNumberForPersistedSavedResources(nextScratch);
      const playerId = (rawEvent as { playerId?: unknown }).playerId;
      const ordinaryLines =
        (rawEvent as { ordinaryLines?: unknown }).ordinaryLines;
      const joiningLines =
        (rawEvent as { joiningLines?: unknown }).joiningLines;

      if (
        turnNumber === null ||
        typeof playerId !== "string" ||
        !isFiniteNumber(ordinaryLines) ||
        !isFiniteNumber(joiningLines)
      ) {
        continue;
      }

      const capture = ensureCaptureForTurn(nextScratch, turnNumber);
      capture.savedResourcesByPlayerId[playerId] = {
        ordinaryLines,
        joiningLines,
      };
      continue;
    }

    if (!isCaptureEvent(rawEvent)) continue;

    const capture = ensureCaptureForTurn(nextScratch, rawEvent.turnNumber);

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
          targetShipDefIds: [...rawEvent.targetShipDefIds],
          bucket: rawEvent.bucket,
        });
        break;
      case "BATTLE_LOG_CAPTURE_BATTLE_STEAL":
        getOrCreateBattleAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "steal",
          sourceShipDefId: rawEvent.sourceShipDefId,
          targetShipDefIds: [...rawEvent.targetShipDefIds],
          bucket: rawEvent.bucket,
        });
        break;
      case "BATTLE_LOG_CAPTURE_BATTLE_FRIGATE_HIT":
        getOrCreateBattleAtomsForPlayer(capture, rawEvent.playerId).push({
          kind: "frigate_hit",
          bucket: 2,
        });
        break;
    }
  }

  return nextScratch;
}

export function foldBattleLogCaptureEvents(
  store: BattleLogHistoryStore,
  events: unknown[],
): BattleLogHistoryStore {
  const nextStore = normalizeBattleLogHistoryStore(store.gameId, store);
  const nextScratch = foldBattleLogCaptureEventsIntoScratch(
    {
      currentTurnCapture: nextStore.currentTurnCapture,
      lastFinalizedTurnNumber: getLatestTurnNumberFromHistoryStore(nextStore),
    },
    events,
  );

  nextStore.currentTurnCapture = nextScratch.currentTurnCapture;
  return nextStore;
}

export function detectCompletedBattleTurnFromStateTransition(
  previousState: GameStateLike,
  nextState: GameStateLike,
): number | null {
  // Deprecated: battle-log finalization now uses explicit
  // BATTLE_LOG_FINALIZE_TURN engine events instead of route-time state diffs.
  const previousTurnNumber = getCurrentTurnNumber(previousState);
  const nextTurnNumber = getCurrentTurnNumber(nextState);
  const previousPhaseKey = getPhaseKeyFromState(previousState);
  const nextPhaseKey = getPhaseKeyFromState(nextState);
  const previousStatus = previousState?.status;
  const nextStatus = nextState?.status;
  const previousTurnIsPositive = previousTurnNumber > 0;
  const previousStatusIsNotFinished = previousStatus !== "finished";
  const previousStateIsBattlePhase = isBattlePhaseKey(previousPhaseKey);
  const nextStateIsNextTurnBuild = isStartOfNextTurnBuild(
    nextState,
    previousTurnNumber,
  );

  if (
    previousTurnIsPositive &&
    previousStatusIsNotFinished &&
    previousStateIsBattlePhase &&
    nextStateIsNextTurnBuild
  ) {
    return previousTurnNumber;
  }

  const resultReason = nextState?.resultReason;
  const isBattleTerminalReason =
    resultReason === "decisive" ||
    resultReason === "narrow" ||
    resultReason === "mutual_destruction";

  if (
    previousTurnIsPositive &&
    previousStateIsBattlePhase &&
    previousStatusIsNotFinished &&
    nextStatus === "finished" &&
    isBattleTerminalReason &&
    nextTurnNumber === previousTurnNumber
  ) {
    return nextTurnNumber;
  }

  if (previousTurnIsPositive && previousStatusIsNotFinished) {
    debugLog("[BattleLog][Detector] Non-terminal finalization missed", {
      previousState: {
        turnNumber: previousTurnNumber,
        status: previousStatus ?? null,
        phaseKey: previousPhaseKey,
      },
      nextState: {
        turnNumber: nextTurnNumber,
        status: nextStatus ?? null,
        phaseKey: nextPhaseKey,
      },
      checks: {
        previousTurnNumberIsPositive: previousTurnIsPositive,
        previousStatusIsNotFinished,
        previousStateIsBattlePhase,
        nextStateIsNextTurnBuild,
      },
    });
  }

  return null;
}

export function buildBattleLogTurnSummaryFromScratch(args: {
  scratch: BattleLogScratch;
  finalizedTurnNumber: number;
  finalizedState: GameStateLike;
}): BattleLogTurnSummary {
  const normalizedScratch = normalizeBattleLogScratch(args.scratch);
  const capture =
    normalizedScratch.currentTurnCapture?.turnNumber === args.finalizedTurnNumber
      ? normalizedScratch.currentTurnCapture
      : null;
  const activePlayers = getActivePlayers(args.finalizedState);
  const lastTurnDamageByPlayerId =
    args.finalizedState?.gameData?.lastTurnDamageByPlayerId ?? {};
  const lastTurnHealByPlayerId =
    args.finalizedState?.gameData?.lastTurnHealByPlayerId ?? {};
  const lastTurnNetByPlayerId =
    args.finalizedState?.gameData?.lastTurnNetByPlayerId ?? {};
  const lastTurnDamageDealtBreakdownByPlayerId =
    args.finalizedState?.gameData?.lastTurnDamageDealtBreakdownByPlayerId ?? {};
  const lastTurnHealingReceivedBreakdownByPlayerId =
    args.finalizedState?.gameData?.lastTurnHealingReceivedBreakdownByPlayerId ??
      {};

  const buildLinesByPlayerId: Record<string, string[]> = {};
  const battleLinesByPlayerId: Record<string, string[]> = {};
  const analysisByPlayerId: Record<string, BattleLogTurnPlayerAnalysis> = {};

  for (const player of activePlayers) {
    const buildAtoms = capture?.buildAtomsByPlayerId?.[player.id] ?? [];
    const battleAtoms = capture?.battleAtomsByPlayerId?.[player.id] ?? [];
    const savedResources = getSavedResourcesSnapshotForTurn({
      capture,
      finalizedTurnNumber: args.finalizedTurnNumber,
      finalizedState: args.finalizedState,
      playerId: player.id,
      fallbackPlayer: player,
    });
    buildLinesByPlayerId[player.id] = formatBuildLines(buildAtoms);
    battleLinesByPlayerId[player.id] = formatBattleLines(battleAtoms);

    const analysis: BattleLogTurnPlayerAnalysis = {
      damageTaken: isFiniteNumber(lastTurnDamageByPlayerId[player.id])
        ? lastTurnDamageByPlayerId[player.id]
        : 0,
      healReceived: isFiniteNumber(lastTurnHealByPlayerId[player.id])
        ? lastTurnHealByPlayerId[player.id]
        : 0,
      netHealthDelta: isFiniteNumber(lastTurnNetByPlayerId[player.id])
        ? lastTurnNetByPlayerId[player.id]
        : 0,
      savedLinesEnd: savedResources.ordinaryLines,
      savedJoiningLinesEnd: savedResources.joiningLines,
    };

    const damageDealtBreakdown = groupBattleLogAnalysisBreakdownRows(
      lastTurnDamageDealtBreakdownByPlayerId[player.id],
    );
    if (damageDealtBreakdown) {
      analysis.damageDealtBreakdown = damageDealtBreakdown;
    }

    const healingReceivedBreakdown = groupBattleLogAnalysisBreakdownRows(
      lastTurnHealingReceivedBreakdownByPlayerId[player.id],
    );
    if (healingReceivedBreakdown) {
      analysis.healingReceivedBreakdown = healingReceivedBreakdown;
    }

    analysisByPlayerId[player.id] = analysis;
  }

  return {
    turnNumber: args.finalizedTurnNumber,
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
    analysisByPlayerId: Object.keys(analysisByPlayerId).length > 0
      ? analysisByPlayerId
      : undefined,
  };
}

export function appendBattleLogTurnSummaryIdempotently(
  store: BattleLogHistoryStore,
  summary: BattleLogTurnSummary,
): { historyStore: BattleLogHistoryStore; appended: boolean } {
  const nextStore = normalizeBattleLogHistoryStore(store.gameId, store);
  const turnAlreadyPresent = nextStore.turns.some(
    (turn) => turn.turnNumber === summary.turnNumber,
  );

  if (turnAlreadyPresent) {
    nextStore.completedTurnCount = nextStore.turns.length;
    nextStore.currentTurnCapture = null;
    return {
      historyStore: nextStore,
      appended: false,
    };
  }

  nextStore.turns = [...nextStore.turns, cloneBattleLogTurnSummary(summary)];
  nextStore.completedTurnCount = nextStore.turns.length;
  nextStore.revision += 1;
  nextStore.currentTurnCapture = null;

  return {
    historyStore: nextStore,
    appended: true,
  };
}

export function finalizeBattleLogTurn(
  store: BattleLogHistoryStore,
  finalizedTurnNumber: number,
  finalizedState: GameStateLike,
): BattleLogHistoryStore {
  const normalizedStore = normalizeBattleLogHistoryStore(store.gameId, store);
  const summary = buildBattleLogTurnSummaryFromScratch({
    scratch: {
      currentTurnCapture: normalizedStore.currentTurnCapture,
      lastFinalizedTurnNumber: getLatestTurnNumberFromHistoryStore(
        normalizedStore,
      ),
    },
    finalizedTurnNumber,
    finalizedState,
  });

  return appendBattleLogTurnSummaryIdempotently(store, summary).historyStore;
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
    if (
      !isFiniteNumber(createdShipsFromDestroy) ||
      createdShipsFromDestroy <= 0
    ) {
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

export function createBattleLogFrigateHitCaptureEventsFromResolution(args: {
  turnNumber: number;
  effects: Effect[];
  effectEvents: EffectEvent[];
}): BattleLogCaptureEvent[] {
  const damageMatches = getMatchedEffectEvents(
    args.effects,
    args.effectEvents,
    "Damage",
  );
  const captureEvents: BattleLogCaptureEvent[] = [];

  for (const match of damageMatches) {
    if (match.effect.kind !== EffectKind.Damage) continue;
    if (match.effect.source.type !== "ship") continue;
    if (match.effect.source.shipDefId !== "FRI") continue;

    captureEvents.push({
      type: "BATTLE_LOG_CAPTURE_BATTLE_FRIGATE_HIT",
      turnNumber: args.turnNumber,
      playerId: match.effect.ownerPlayerId,
    });
  }

  return captureEvents;
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
        getShipDefIdByInstanceId(args.stateBeforeResolution, instanceId)
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

  const sourceEffect = args.effects.find(
    (effect) => effect.source.type === "ship",
  );
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
