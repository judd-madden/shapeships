import type { EffectEvent } from "../../engine_shared/effects/applyEffects.ts";
import { EffectKind, type Effect } from "../../engine_shared/effects/Effect.ts";
import { getShipById } from "../../engine_shared/defs/ShipDefinitions.core.ts";
import {
  DEFAULT_PLAYER_MAX_HEALTH,
  getPlayerMaxHealth,
} from "../../engine_shared/maximumHealth.ts";
import {
  getAncientSolarPowerDisplayName,
  isAncientSolarPowerId,
} from "../ancient/ancientSolarPowerPresentation.ts";
import type {
  AncientSolarLedgerEntry,
  AncientSolarLedgerState,
  AncientSolarPowerId,
} from "./GameStateTypes.ts";
import { debugLog } from "../../utils/serverLogger.ts";

export type BattleLogHistoryResponse = {
  gameId: string;
  revision: number;
  completedTurnCount: number;
  turns: BattleLogTurnSummary[];
};

export type BattleLogAnalysisBreakdownRow =
  | {
      rowKind: "ship";
      label: string;
      count?: number;
      amount: number;
    }
  | {
      rowKind: "solar_power";
      solarPowerId: AncientSolarPowerId;
      label: string;
      count: number;
      amount: number;
    }
  | {
      rowKind: "adjustment";
      label: string;
      amount: number;
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
    maxHealthEnd: number;
    healthDelta: number;
    fleetValueEnd: number;
  }>;
  buildLinesByPlayerId: Record<string, string[]>;
  battleLinesByPlayerId: Record<string, string[]>;
  analysisByPlayerId?: Record<string, BattleLogTurnPlayerAnalysis>;
};

export type ProducedBuildOccurrence =
  | { stage: "drawing_prelude"; passIndex: 1 | 2 }
  | { stage: "drawing" }
  | { stage: "end_of_build" };

type BuildCaptureAtom =
  | {
      kind: "reroll";
      sourceShipDefId: string;
      values: number[];
    }
  | {
      kind: "chronoswarm_roll";
      rolls: number[];
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
      producedBuildOccurrence?: ProducedBuildOccurrence;
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
  archiveCheckpoint?: BattleLogArchiveCheckpoint | null;
};

export type BattleLogArchiveCheckpoint = {
  finalizedTurnNumber: number;
  acceptedStateRevision: number;
  summary: BattleLogTurnSummary;
};

export type BattleLogAppendResult =
  | { status: "appended"; historyStore: BattleLogHistoryStore }
  | { status: "already_present"; historyStore: BattleLogHistoryStore }
  | {
      status: "divergent";
      existing: BattleLogTurnSummary;
      candidate: BattleLogTurnSummary;
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
      producedBuildOccurrence?: ProducedBuildOccurrence;
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
    ancient?: {
      solarLedgerByPlayerId?: Record<string, AncientSolarLedgerState>;
    };
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
  producedBuildOccurrence?: ProducedBuildOccurrence;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasExactOwnKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]);
}

function normalizeProducedBuildOccurrence(
  value: unknown,
): ProducedBuildOccurrence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const occurrence = value as Record<string, unknown>;
  if (occurrence.stage === "drawing_prelude") {
    if (
      !hasExactOwnKeys(occurrence, ["stage", "passIndex"]) ||
      !Number.isInteger(occurrence.passIndex) ||
      (occurrence.passIndex !== 1 && occurrence.passIndex !== 2)
    ) {
      return null;
    }
    return {
      stage: "drawing_prelude",
      passIndex: occurrence.passIndex,
    };
  }
  if (occurrence.stage === "drawing" || occurrence.stage === "end_of_build") {
    if (!hasExactOwnKeys(occurrence, ["stage"])) return null;
    return { stage: occurrence.stage };
  }
  return null;
}

function readOptionalProducedBuildOccurrence(
  holder: Record<string, unknown>,
): ProducedBuildOccurrence | undefined {
  if (!Object.prototype.hasOwnProperty.call(holder, "producedBuildOccurrence")) {
    return undefined;
  }
  const occurrence = normalizeProducedBuildOccurrence(
    holder.producedBuildOccurrence,
  );
  if (!occurrence) {
    throw new Error("BATTLE_LOG_INVALID_PRODUCED_OCCURRENCE_INVARIANT");
  }
  return occurrence;
}

function isD6Roll(value: unknown): value is number {
  return isFiniteNumber(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6;
}

function normalizeChronoswarmRolls(rawRolls: unknown): number[] {
  return Array.isArray(rawRolls) ? rawRolls.filter(isD6Roll) : [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type AuthoritativeBreakdownRowLike = {
  label?: unknown;
  amount?: unknown;
  count?: unknown;
  rowKind?: unknown;
  solarPowerId?: unknown;
};

function cloneBattleLogAnalysisBreakdownRow(
  row: BattleLogAnalysisBreakdownRow,
): BattleLogAnalysisBreakdownRow {
  if (row.rowKind === "solar_power") {
    return {
      rowKind: "solar_power",
      solarPowerId: row.solarPowerId,
      label: row.label,
      count: row.count,
      amount: row.amount,
    };
  }

  if (row.rowKind === "adjustment") {
    return {
      rowKind: "adjustment",
      label: row.label,
      amount: row.amount,
    };
  }

  return {
    rowKind: "ship",
    label: row.label,
    count: row.count,
    amount: row.amount,
  };
}

function normalizeBattleLogAnalysisBreakdownRow(
  rawRow: unknown,
): BattleLogAnalysisBreakdownRow | null {
  if (!rawRow || typeof rawRow !== "object") {
    return null;
  }

  const row = rawRow as AuthoritativeBreakdownRowLike;
  const amount = isFiniteNumber(row.amount) ? row.amount : 0;

  if (amount === 0) {
    return null;
  }

  if (row.rowKind === "solar_power") {
    if (
      !isAncientSolarPowerId(row.solarPowerId) ||
      !isFiniteNumber(row.count) ||
      !Number.isInteger(row.count) ||
      row.count <= 0
    ) {
      return null;
    }

    return {
      rowKind: "solar_power",
      solarPowerId: row.solarPowerId,
      label: getAncientSolarPowerDisplayName(row.solarPowerId),
      count: row.count,
      amount,
    };
  }

  const label = isNonEmptyString(row.label) ? row.label.trim() : "";
  if (!label) {
    return null;
  }

  if (row.rowKind === "adjustment") {
    return {
      rowKind: "adjustment",
      label,
      amount,
    };
  }

  if (row.rowKind !== undefined && row.rowKind !== "ship") {
    return null;
  }

  const count = isFiniteNumber(row.count) &&
      Number.isInteger(row.count) &&
      row.count > 0
    ? row.count
    : undefined;

  return {
    rowKind: "ship",
    label,
    count,
    amount,
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

    const identity = normalizedRow.rowKind === "solar_power"
      ? `solar_power:${normalizedRow.solarPowerId}`
      : `${normalizedRow.rowKind}:${normalizedRow.label}`;
    const existing = groupedRows.get(identity);
    if (!existing) {
      groupedRows.set(identity, normalizedRow);
      continue;
    }

    existing.amount += normalizedRow.amount;
    if (existing.rowKind === "ship" && normalizedRow.rowKind === "ship") {
      const existingCount = existing.count ?? 1;
      const incomingCount = normalizedRow.count ?? 1;
      existing.count = existingCount + incomingCount;
    } else if (
      existing.rowKind === "solar_power" &&
      normalizedRow.rowKind === "solar_power"
    ) {
      existing.count += normalizedRow.count;
    }
  }

  const rows = [...groupedRows.values()].filter((row) => row.amount !== 0);
  if (rows.length <= 0) {
    return undefined;
  }

  return rows
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }
      return left.label.localeCompare(right.label);
    })
    .map(cloneBattleLogAnalysisBreakdownRow);
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

  if (atom.kind === "chronoswarm_roll") {
    return {
      kind: "chronoswarm_roll",
      rolls: normalizeChronoswarmRolls(atom.rolls),
    };
  }

  if (atom.kind === "manual_build") {
    return {
      kind: "manual_build",
      shipDefId: atom.shipDefId,
    };
  }

  const producedBuildOccurrence = readOptionalProducedBuildOccurrence(
    atom as unknown as Record<string, unknown>,
  );
  return {
    kind: "produced_build",
    shipDefId: atom.shipDefId,
    sourceShipDefId: atom.sourceShipDefId,
    count: atom.count,
    ...(producedBuildOccurrence ? { producedBuildOccurrence } : {}),
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
        if (kind === "chronoswarm_roll") {
          return normalizeChronoswarmRolls((atom as { rolls?: unknown }).rolls)
            .length > 0;
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
      .map(cloneBuildCaptureAtom)
      .filter((atom) =>
        atom.kind !== "chronoswarm_roll" || atom.rolls.length > 0
      );
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
      maxHealthEnd: isFiniteNumber(player.maxHealthEnd)
        ? player.maxHealthEnd
        : DEFAULT_PLAYER_MAX_HEALTH,
      healthDelta: player.healthDelta,
      fleetValueEnd: isFiniteNumber(player.fleetValueEnd)
        ? player.fleetValueEnd
        : 0,
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

function getFleetValueLineCostForShipDef(shipDefId: string): number {
  const shipDef = getShipById(shipDefId);
  const totalLineCost = shipDef?.totalLineCost;
  return Number.isInteger(totalLineCost) ? Number(totalLineCost) : 0;
}

function computeFleetValueEndForPlayer(
  state: GameStateLike,
  playerId: string,
): number {
  const fleet = state?.gameData?.ships?.[playerId];
  if (!Array.isArray(fleet)) return 0;

  return fleet.reduce((total, ship) => {
    const shipDefId = ship?.shipDefId;
    if (typeof shipDefId !== "string") return total;
    return total + getFleetValueLineCostForShipDef(shipDefId);
  }, 0);
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

function pushChronoswarmRollAtom(atoms: BuildCaptureAtom[], rolls: number[]) {
  const normalizedRolls = normalizeChronoswarmRolls(rolls);
  if (normalizedRolls.length <= 0) return;

  atoms.push({
    kind: "chronoswarm_roll",
    rolls: normalizedRolls,
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

type AncientSolarBattlePresentation = {
  key: string;
  label: string;
  suffix: string;
};

function getAncientSolarBattlePresentation(
  state: GameStateLike,
  entry: AncientSolarLedgerEntry,
): AncientSolarBattlePresentation {
  const label = getAncientSolarPowerDisplayName(entry.solarPowerId);

  if (entry.solarPowerId === "SSIM") {
    const copiedShipDefId = entry.simulacrum?.copiedShipDefId;
    const validCopiedShipDefId =
      typeof copiedShipDefId === "string" && getShipById(copiedShipDefId)
        ? copiedShipDefId
        : null;
    return {
      key: validCopiedShipDefId
        ? `SSIM:${validCopiedShipDefId}`
        : "SSIM",
      label,
      suffix: validCopiedShipDefId ? ` (${validCopiedShipDefId})` : "",
    };
  }

  if (entry.solarPowerId === "SBLA") {
    const targetShipDefIds = (entry.targets ?? []).flatMap((target) => {
      const targetInstanceId = target.shipInstanceId;
      if (typeof targetInstanceId !== "string") return [];
      const shipDefId = getShipDefIdByInstanceId(state, targetInstanceId);
      return shipDefId ? [shipDefId] : [];
    });
    return {
      key: `SBLA:${targetShipDefIds.join("|")}`,
      label,
      suffix: targetShipDefIds.length > 0
        ? ` destroyed ${formatJoinedShipDefIds(targetShipDefIds)}`
        : "",
    };
  }

  return {
    key: entry.solarPowerId,
    label,
    suffix: "",
  };
}

function formatAncientSolarBattleLines(
  state: GameStateLike,
  playerId: string,
  finalizedTurnNumber: number,
): string[] {
  const ledger =
    state.gameData?.ancient?.solarLedgerByPlayerId?.[playerId];
  if (
    ledger?.battleTurnNumber !== finalizedTurnNumber ||
    !Array.isArray(ledger.entries)
  ) {
    return [];
  }

  const presentations = ledger.entries.map((entry) =>
    getAncientSolarBattlePresentation(state, entry)
  );
  return collapseCountLines(
    presentations,
    (presentation) => presentation.key,
    (presentation, count) =>
      `${count} x ${presentation.label}${presentation.suffix}`,
  );
}

function collapseProducedBuildLines(
  producedBuilds: Array<Extract<BuildCaptureAtom, { kind: "produced_build" }>>,
): string[] {
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
  return producedLines;
}

function formatLegacyBuildLines(buildAtoms: BuildCaptureAtom[]): string[] {
  const rerollLines: string[] = [];
  const chronoswarmLines: string[] = [];
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

    if (atom.kind === "chronoswarm_roll") {
      const rolls = normalizeChronoswarmRolls(atom.rolls);
      if (rolls.length === 1) {
        chronoswarmLines.push(`CHR rolled ${rolls[0]}`);
      } else if (rolls.length > 1) {
        chronoswarmLines.push(`CHR rolled ${rolls.join(", ")}`);
      }
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

  const producedLines = collapseProducedBuildLines(producedBuilds);

  return [
    ...rerollLines,
    ...chronoswarmLines,
    ...manualLines,
    ...producedLines,
  ];
}

function formatBuildLines(buildAtoms: BuildCaptureAtom[]): string[] {
  const producedBuilds = buildAtoms.filter(
    (atom): atom is Extract<BuildCaptureAtom, { kind: "produced_build" }> =>
      atom.kind === "produced_build",
  );
  const hasDrawingPreludeOccurrence = producedBuilds.some((atom) =>
    atom.producedBuildOccurrence?.stage === "drawing_prelude"
  );
  if (!hasDrawingPreludeOccurrence) return formatLegacyBuildLines(buildAtoms);

  if (producedBuilds.some((atom) => !atom.producedBuildOccurrence)) {
    throw new Error("BATTLE_LOG_PRODUCED_OCCURRENCE_INVARIANT");
  }

  const rerollLines: string[] = [];
  const chronoswarmLines: string[] = [];
  const manualBuilds: Array<
    Extract<BuildCaptureAtom, { kind: "manual_build" }>
  > = [];
  for (const atom of buildAtoms) {
    if (atom.kind === "reroll") {
      rerollLines.push(
        `${atom.sourceShipDefId} rerolled ${atom.values.join(" -> ")}`,
      );
    } else if (atom.kind === "chronoswarm_roll") {
      const rolls = normalizeChronoswarmRolls(atom.rolls);
      if (rolls.length === 1) chronoswarmLines.push(`CHR rolled ${rolls[0]}`);
      else if (rolls.length > 1) chronoswarmLines.push(`CHR rolled ${rolls.join(", ")}`);
    } else if (atom.kind === "manual_build") {
      manualBuilds.push(atom);
    }
  }

  const manualLines = collapseCountLines(
    manualBuilds,
    (atom) => atom.shipDefId,
    (atom, count) => `${count} x ${atom.shipDefId}`,
  );
  const preludePass1 = producedBuilds.filter((atom) =>
    atom.producedBuildOccurrence?.stage === "drawing_prelude" &&
    atom.producedBuildOccurrence.passIndex === 1
  );
  const preludePass2 = producedBuilds.filter((atom) =>
    atom.producedBuildOccurrence?.stage === "drawing_prelude" &&
    atom.producedBuildOccurrence.passIndex === 2
  );
  const drawing = producedBuilds.filter((atom) =>
    atom.producedBuildOccurrence?.stage === "drawing"
  );
  const endOfBuild = producedBuilds.filter((atom) =>
    atom.producedBuildOccurrence?.stage === "end_of_build"
  );

  return [
    ...rerollLines,
    ...chronoswarmLines,
    ...collapseProducedBuildLines(preludePass1),
    ...collapseProducedBuildLines(preludePass2),
    ...manualLines,
    ...collapseProducedBuildLines(drawing),
    ...collapseProducedBuildLines(endOfBuild),
  ];
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
    archiveCheckpoint: null,
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
  const rawCheckpoint = scratch.archiveCheckpoint;
  const archiveCheckpoint =
    rawCheckpoint &&
      typeof rawCheckpoint === "object" &&
      isFiniteNumber(rawCheckpoint.finalizedTurnNumber) &&
      Number.isInteger(rawCheckpoint.finalizedTurnNumber) &&
      rawCheckpoint.finalizedTurnNumber > 0 &&
      isFiniteNumber(rawCheckpoint.acceptedStateRevision) &&
      Number.isInteger(rawCheckpoint.acceptedStateRevision) &&
      rawCheckpoint.acceptedStateRevision > 0 &&
      rawCheckpoint.summary &&
      typeof rawCheckpoint.summary === "object" &&
      rawCheckpoint.summary.turnNumber === rawCheckpoint.finalizedTurnNumber
      ? structuredClone(rawCheckpoint)
      : null;
  return {
    currentTurnCapture: normalizeBattleLogCurrentTurnCapture(
      scratch.currentTurnCapture,
    ),
    lastFinalizedTurnNumber: isFiniteNumber(scratch.lastFinalizedTurnNumber)
      ? scratch.lastFinalizedTurnNumber
      : null,
    archiveCheckpoint,
  };
}

export function getBattleLogArchiveCheckpointFromState(
  state: GameStateLike | null | undefined,
): BattleLogArchiveCheckpoint | null {
  return normalizeBattleLogScratch(state?.battleLogScratch).archiveCheckpoint ?? null;
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
    archiveCheckpoint: null,
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
    archiveCheckpoint: normalizedScratch.archiveCheckpoint ?? null,
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

  const eventType = (event as { type?: string }).type;
  if (eventType === "DICE_ROLLED" || eventType === "CHRONOSWARM_ROLLED") {
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

    if ((rawEvent as { type?: string }).type === "CHRONOSWARM_ROLLED") {
      const turnNumber = getBattleLogCaptureTurnNumber(rawEvent);
      const rolls = normalizeChronoswarmRolls(
        (rawEvent as { rolls?: unknown }).rolls,
      );
      const countByPlayerId =
        (rawEvent as { chronoswarmCountByPlayerId?: unknown })
          .chronoswarmCountByPlayerId;

      if (
        turnNumber === null ||
        rolls.length <= 0 ||
        !countByPlayerId ||
        typeof countByPlayerId !== "object"
      ) {
        continue;
      }

      const capture = ensureCaptureForTurn(nextScratch, turnNumber);
      for (const [playerId, rawCount] of Object.entries(
        countByPlayerId as Record<string, unknown>,
      )) {
        if (!isFiniteNumber(rawCount) || !Number.isInteger(rawCount)) {
          continue;
        }

        const count = Math.min(rawCount, 3);
        if (count <= 0) continue;

        const displayedRolls = rolls.slice(0, count);
        if (displayedRolls.length <= 0) continue;

        pushChronoswarmRollAtom(
          getOrCreateBuildAtomsForPlayer(capture, playerId),
          displayedRolls,
        );
      }
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
        {
          const producedBuildOccurrence = readOptionalProducedBuildOccurrence(
            rawEvent as unknown as Record<string, unknown>,
          );
          getOrCreateBuildAtomsForPlayer(capture, rawEvent.playerId).push({
            kind: "produced_build",
            shipDefId: rawEvent.shipDefId,
            sourceShipDefId: rawEvent.sourceShipDefId,
            count: rawEvent.count,
            ...(producedBuildOccurrence ? { producedBuildOccurrence } : {}),
          });
          break;
        }
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
    battleLinesByPlayerId[player.id] = [
      ...formatBattleLines(battleAtoms),
      ...formatAncientSolarBattleLines(
        args.finalizedState,
        player.id,
        args.finalizedTurnNumber,
      ),
    ];

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
      maxHealthEnd: getPlayerMaxHealth(args.finalizedState, player.id),
      healthDelta: isFiniteNumber(lastTurnNetByPlayerId[player.id])
        ? lastTurnNetByPlayerId[player.id]
        : 0,
      fleetValueEnd: computeFleetValueEndForPlayer(
        args.finalizedState,
        player.id,
      ),
    })),
    buildLinesByPlayerId,
    battleLinesByPlayerId,
    analysisByPlayerId: Object.keys(analysisByPlayerId).length > 0
      ? analysisByPlayerId
      : undefined,
  };
}

function canonicalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  if (value && typeof value === "object") {
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (typeof child !== "undefined") {
        ordered[key] = canonicalizeJsonValue(child);
      }
    }
    return ordered;
  }
  return value;
}

export function areBattleLogTurnSummariesEqual(
  left: BattleLogTurnSummary,
  right: BattleLogTurnSummary,
): boolean {
  const canonicalLeft = canonicalizeJsonValue(cloneBattleLogTurnSummary(left));
  const canonicalRight = canonicalizeJsonValue(cloneBattleLogTurnSummary(right));
  return JSON.stringify(canonicalLeft) === JSON.stringify(canonicalRight);
}

export function appendBattleLogTurnSummaryIdempotently(
  store: BattleLogHistoryStore,
  summary: BattleLogTurnSummary,
): BattleLogAppendResult {
  const nextStore = normalizeBattleLogHistoryStore(store.gameId, store);
  const existing = nextStore.turns.find(
    (turn) => turn.turnNumber === summary.turnNumber,
  );

  if (existing) {
    if (!areBattleLogTurnSummariesEqual(existing, summary)) {
      return {
        status: "divergent",
        existing: cloneBattleLogTurnSummary(existing),
        candidate: cloneBattleLogTurnSummary(summary),
      };
    }
    nextStore.completedTurnCount = nextStore.turns.length;
    nextStore.currentTurnCapture = null;
    return {
      status: "already_present",
      historyStore: nextStore,
    };
  }

  nextStore.turns = [...nextStore.turns, cloneBattleLogTurnSummary(summary)];
  nextStore.completedTurnCount = nextStore.turns.length;
  nextStore.revision += 1;
  nextStore.currentTurnCapture = null;

  return {
    status: "appended",
    historyStore: nextStore,
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

  const appendResult = appendBattleLogTurnSummaryIdempotently(store, summary);
  return appendResult.status === "divergent"
    ? normalizeBattleLogHistoryStore(store.gameId, store)
    : appendResult.historyStore;
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
  producedBuildOccurrence?: ProducedBuildOccurrence;
}): BattleLogCaptureEvent {
  const producedBuildOccurrence = typeof args.producedBuildOccurrence === "undefined"
    ? null
    : normalizeProducedBuildOccurrence(args.producedBuildOccurrence);
  if (
    typeof args.producedBuildOccurrence !== "undefined" &&
    !producedBuildOccurrence
  ) {
    throw new Error("INVALID_PRODUCED_BUILD_OCCURRENCE");
  }
  return {
    type: "BATTLE_LOG_CAPTURE_BUILD_PRODUCED",
    turnNumber: args.turnNumber,
    playerId: args.playerId,
    shipDefId: args.shipDefId,
    sourceShipDefId: args.sourceShipDefId,
    count: isFiniteNumber(args.count) && args.count > 0 ? args.count : 1,
    ...(producedBuildOccurrence ? { producedBuildOccurrence } : {}),
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
        ...(args.producedBuildOccurrence
          ? { producedBuildOccurrence: args.producedBuildOccurrence }
          : {}),
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
        ...(args.producedBuildOccurrence
          ? { producedBuildOccurrence: args.producedBuildOccurrence }
          : {}),
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
    args.phaseKey === "battle.charge_declaration" &&
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
