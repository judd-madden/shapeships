import {
  classifyBattleLogBuildLine,
  mapBattleLogLines,
  tokenizeBattleLine,
  tokenizeBuildLine,
} from './battleLog';
import {
  getCanonicalDraftFingerprint,
  getCurrentTurnPreviewCandidateIdentity,
  type CurrentTurnPreviewCandidateInput,
  type CurrentTurnPreviewState,
} from './currentTurnPreview';
import {
  getManualBuildGroupCount,
  type CanonicalBuildSubmitPayload,
} from './intents';
import type { ProvisionalEvolverConversion } from './provisionalBuild';
import { isResolvedHealthBoundary } from './resolvedHealth';
import {
  getLastTurnDamageDealtBreakdownByPlayerId,
  getLastTurnHealingReceivedBreakdownByPlayerId,
  getLastTurnResolvedHealthFacts,
  getPlayerIdentityKey,
  getPlayers,
  getResultReason,
  getTurnNumber,
  isGameFinished,
} from './selectors';
import type {
  BattleLogHistoryResponse,
  BoardStatBreakdownRowVm,
  ThisTurnBuildRowUnitVm,
  ThisTurnLiveLogVm,
  ThisTurnMetricVm,
  ThisTurnPlayerMetricsVm,
  ThisTurnPresentationVm,
  ThisTurnResolutionSnapshot,
} from './types';

type MetricInput = { total: number; rows: BoardStatBreakdownRowVm[] } | null;

export interface LastTurnPresentationInput {
  turnNumber: number;
  me: { damage: MetricInput; healing: MetricInput };
  opponent: { damage: MetricInput; healing: MetricInput };
}

interface ResolutionFacts {
  damageTaken: number;
  healReceived: number;
  netHealthDelta: number;
  healthEnd: number;
}

export interface ResolvedTurnPresentationInput extends LastTurnPresentationInput {
  gameId: string;
  mePlayerId: string;
  opponentPlayerId: string;
  factsByPlayerId: Record<string, ResolutionFacts>;
}

const HEALTH_FINISH_REASONS = new Set(['decisive', 'narrow', 'mutual_destruction']);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Contribution totals can differ from target damage/gross healing (e.g. self-damage). */
function resolvedMetric(rows: unknown): MetricInput {
  if (!Array.isArray(rows) || rows.some((row) =>
    !isRecord(row) || typeof row.label !== 'string' || !finite(row.amount) ||
    !['ship', 'adjustment', 'solar_power'].includes(row.rowKind) ||
    (row.rowKind === 'solar_power' && typeof row.solarPowerId !== 'string')
  )) return null;
  const normalized = normalizeRows(rows);
  const total = normalized.reduce((sum, row) => sum + row.amount, 0);
  return finite(total) ? { total, rows: normalized } : null;
}

/** Read one authoritative aggregate envelope; never borrow provenance from another. */
export function readResolvedTurnPresentationInput(args: {
  state: any;
  gameId: string;
  mePlayerId: string | null;
  opponentPlayerId: string | null;
}): ResolvedTurnPresentationInput | null {
  const { state, gameId, mePlayerId, opponentPlayerId } = args;
  if (state?.gameId !== gameId || !mePlayerId || !opponentPlayerId ||
      mePlayerId === opponentPlayerId) return null;
  const ids = [mePlayerId, opponentPlayerId];
  const players = getPlayers(state);
  const facts = getLastTurnResolvedHealthFacts(state);
  const resolution = facts.healthResolution;
  const currentTurn = getTurnNumber(state);
  const atBoundary = isResolvedHealthBoundary(state, currentTurn);
  // Legacy boundary responses have unambiguous period identity without metadata.
  if (resolution === undefined ? !atBoundary :
      !isRecord(resolution) || !Number.isInteger(resolution.resolvedTurnNumber) ||
      resolution.resolvedTurnNumber < 1 || resolution.resolvedTurnNumber > currentTurn ||
      (isGameFinished(state) && HEALTH_FINISH_REASONS.has(getResultReason(state)) &&
        resolution.resolvedTurnNumber !== currentTurn) ||
      ![resolution.finalHealthByPlayerId, resolution.maxHealthByPlayerId].every((map) =>
        isRecord(map) && Object.keys(map).length === 2 && ids.every((id) => finite(map[id]))) ||
      !ids.every((id) => resolution.maxHealthByPlayerId[id] > 0)) return null;
  const resolvedTurnNumber = isRecord(resolution) ? resolution.resolvedTurnNumber : currentTurn;
  const factsByPlayerId: Record<string, ResolutionFacts> = {};
  for (const id of ids) {
    const matches = players.filter((player) => getPlayerIdentityKey(player) === id);
    const damageTaken = isRecord(facts.damage) ? facts.damage[id] : undefined;
    const healReceived = isRecord(facts.healing) ? facts.healing[id] : undefined;
    const netHealthDelta = isRecord(facts.net) ? facts.net[id] : undefined;
    if (matches.length !== 1 || !finite(damageTaken) || damageTaken < 0 ||
        !finite(healReceived) || healReceived < 0 || !finite(netHealthDelta) ||
        !finite(matches[0].health) ||
        (isRecord(resolution) && matches[0].health !== resolution.finalHealthByPlayerId[id])) return null;
    factsByPlayerId[id] = { damageTaken, healReceived, netHealthDelta,
      healthEnd: matches[0].health };
  }
  const damage = getLastTurnDamageDealtBreakdownByPlayerId(state);
  const healing = getLastTurnHealingReceivedBreakdownByPlayerId(state);
  const side = (id: string) => ({
    damage: resolvedMetric(damage?.[id]),
    healing: resolvedMetric(healing?.[id]),
  });
  return { gameId, turnNumber: resolvedTurnNumber, mePlayerId, opponentPlayerId,
    me: side(mePlayerId), opponent: side(opponentPlayerId), factsByPlayerId };
}

/** Recovery is a derived view only. It must never enter live capture/animation state. */
export function recoverThisTurnBreakdowns(presentation: ThisTurnPresentationVm, args: {
  gameId: string;
  turnNumber: number;
  isFinished: boolean;
  resultReason: string | null;
  mePlayerId: string | null;
  opponentPlayerId: string | null;
  currentHealthByPlayerId: Readonly<Record<string, unknown>>;
  resolvedTurn: ResolvedTurnPresentationInput | null;
  history: BattleLogHistoryResponse | null;
  resolutionSnapshot: ThisTurnResolutionSnapshot | null;
}): ThisTurnPresentationVm {
  const { mePlayerId, opponentPlayerId } = args;
  if (!mePlayerId || !opponentPlayerId || mePlayerId === opponentPlayerId) return presentation;
  const healthFinish = args.isFinished && HEALTH_FINISH_REASONS.has(args.resultReason ?? '');
  const full = args.resolvedTurn?.gameId === args.gameId &&
      args.resolvedTurn.mePlayerId === mePlayerId &&
      args.resolvedTurn.opponentPlayerId === opponentPlayerId
    ? args.resolvedTurn : null;
  const snapshot = args.resolutionSnapshot?.gameId === args.gameId &&
    args.resolutionSnapshot.me.playerId === mePlayerId &&
    args.resolutionSnapshot.opponent.playerId === opponentPlayerId &&
    args.resolutionSnapshot.resolvedTurnNumber <= args.turnNumber
    ? args.resolutionSnapshot : null;
  const history = args.history?.gameId === args.gameId ? args.history : null;
  const archiveFor = (turnNumber: number) => {
    const matches = history?.turns.filter((turn) => turn.turnNumber === turnNumber) ?? [];
    const turn = matches.length === 1 ? matches[0] : null;
    if (!turn || turnNumber < 1 || turn.players.length !== 2 ||
        ![mePlayerId, opponentPlayerId].every((id) => {
          const players = turn.players.filter((player) => player.playerId === id);
          const analysis = turn.analysisByPlayerId?.[id];
          return players.length === 1 && finite(players[0].healthEnd) &&
            finite(players[0].healthDelta) && analysis && finite(analysis.damageTaken) &&
            finite(analysis.healReceived) && finite(analysis.netHealthDelta) &&
            players[0].healthDelta === analysis.netHealthDelta;
        })) return null;
    if (args.isFinished && turnNumber === args.turnNumber && turn.players.some((player) =>
      !finite(args.currentHealthByPlayerId[player.playerId]) ||
      player.healthEnd !== args.currentHealthByPlayerId[player.playerId])) return null;
    if (full?.turnNumber === turnNumber && ![mePlayerId, opponentPlayerId].every((id) => {
      const player = turn.players.find((candidate) => candidate.playerId === id)!;
      const analysis = turn.analysisByPlayerId?.[id];
      const facts = full.factsByPlayerId[id];
      return analysis && facts && player.healthEnd === facts.healthEnd &&
        player.healthDelta === facts.netHealthDelta && analysis.netHealthDelta === facts.netHealthDelta &&
        analysis.damageTaken === facts.damageTaken && analysis.healReceived === facts.healReceived;
    })) return null;
    return turn;
  };
  const metricsFor = (turnNumber: number): LastTurnPresentationInput => {
    const archive = archiveFor(turnNumber);
    const capturedMetric = (key: 'me' | 'opponent', kind: 'damage' | 'healing'): MetricInput => {
      const value = snapshot?.resolvedTurnNumber === turnNumber ? snapshot[key][kind].current : null;
      return value && (value.state === 'zero' || value.state === 'value') &&
        value.turnNumber === turnNumber && (value.rows.length > 0 || value.total === 0)
        ? { total: value.total, rows: value.rows } : null;
    };
    const side = (id: string, key: 'me' | 'opponent') => ({
      damage: (full?.turnNumber === turnNumber ? full[key].damage : null) ??
        capturedMetric(key, 'damage') ??
        resolvedMetric(archive?.analysisByPlayerId?.[id]?.damageDealtBreakdown),
      healing: (full?.turnNumber === turnNumber ? full[key].healing : null) ??
        capturedMetric(key, 'healing') ??
        resolvedMetric(archive?.analysisByPlayerId?.[id]?.healingReceivedBreakdown),
    });
    return { turnNumber, me: side(mePlayerId, 'me'), opponent: side(opponentPlayerId, 'opponent') };
  };
  const captured = snapshot && snapshot.resolvedTurnNumber === presentation.turnNumber &&
    (!args.isFinished || (healthFinish && snapshot.isTerminalTurn && snapshot.resolvedTurnNumber === args.turnNumber));
  const presentationTurnNumber = args.isFinished ? args.turnNumber : presentation.turnNumber;
  let lastTurnNumber = Math.max(0, presentationTurnNumber - 1);
  if (args.isFinished && !healthFinish && !captured) {
    lastTurnNumber = full?.turnNumber ?? Math.max(snapshot?.resolvedTurnNumber ?? 0, ...(history?.turns ?? [])
      .filter((turn) => turn.turnNumber <= args.turnNumber && archiveFor(turn.turnNumber))
      .map((turn) => turn.turnNumber));
  }
  const last = metricsFor(lastTurnNumber);
  const actual = metricsFor(presentationTurnNumber);
  const enrich = (existing: ThisTurnMetricVm, input: MetricInput, turnNumber: number,
    source: 'last_actual' | 'held_actual' | 'final_actual'): ThisTurnMetricVm => {
    if (existing.turnNumber !== turnNumber || existing.state === 'concealed') return existing;
    if (existing.state === 'value' || existing.state === 'zero') {
      if (existing.rows.length > 0 || existing.total === 0) return existing;
      // A captured aggregate is not permission to substitute different contribution facts.
      return input?.total === existing.total
        ? { ...existing, rows: input.rows }
        : metric(null, turnNumber, source);
    }
    return metric(input, turnNumber, source);
  };
  const side = (key: 'me' | 'opponent'): ThisTurnPlayerMetricsVm => {
    const existing = presentation[key];
    const pair = (kind: 'damage' | 'healing') => {
      const current = captured
        ? enrich(existing[kind].current, actual[key][kind], presentation.turnNumber,
            snapshot!.isTerminalTurn ? 'final_actual' : 'held_actual')
        : healthFinish
          ? metric(actual[key][kind], args.turnNumber, 'final_actual')
          : args.isFinished
            ? metric(null, args.turnNumber, 'final_actual')
            : existing[kind].current;
      return { current, last: captured
        ? enrich(existing[kind].last, last[key][kind], lastTurnNumber, 'last_actual')
        : metric(last[key][kind], lastTurnNumber, 'last_actual') };
    };
    return { ...existing, damage: pair('damage'), healing: pair('healing') };
  };
  const resolvedTurnNumber = captured || healthFinish ? presentationTurnNumber : lastTurnNumber;
  const hasEvidence = snapshot?.resolvedTurnNumber === resolvedTurnNumber ||
    full?.turnNumber === resolvedTurnNumber || archiveFor(resolvedTurnNumber);
  return { ...presentation, turnNumber: presentationTurnNumber, me: side('me'), opponent: side('opponent'),
    resolvedBreakdownPeriod: hasEvidence ? {
      turnNumber: resolvedTurnNumber,
      slot: captured || healthFinish ? 'current' : 'last',
      kind: healthFinish || (captured && snapshot!.isTerminalTurn) ? 'final_turn' : 'last_turn',
    } : null };
}

export interface ThisTurnPresentationArgs {
  gameId: string;
  turnNumber: number;
  phaseKey: string;
  isFinished: boolean;
  viewerRole: 'player' | 'spectator' | 'unknown';
  mePlayerId: string | null;
  opponentPlayerId: string | null;
  localDraft: CanonicalBuildSubmitPayload | null;
  localEvolverConversions?: readonly ProvisionalEvolverConversion[];
  acceptedDraft: CanonicalBuildSubmitPayload | null;
  activePreviewCandidate: CurrentTurnPreviewCandidateInput | null;
  preview: CurrentTurnPreviewState;
  publicThisTurn: unknown;
  requesterThisTurn: unknown;
  ownEstimateMode?: 'base' | 'with_autocast' | 'solar_selection';
  chargeDeclarationState?:
    | { kind: 'none' }
    | { kind: 'editing' }
    | { kind: 'incomplete'; reason: string }
    | { kind: 'recovered' }
    | { kind: 'awaiting_recovery' };
  lastTurn: LastTurnPresentationInput;
  previousPresentation: {
    gameId: string;
    presentation: ThisTurnPresentationVm;
  } | null;
  resolutionSnapshot: ThisTurnResolutionSnapshot | null;
  history: BattleLogHistoryResponse | null;
  archiveRecovery: { turnNumber: number; state: 'pending' | 'deferred' } | null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRows(value: unknown): BoardStatBreakdownRowVm[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): BoardStatBreakdownRowVm[] => {
    if (!isRecord(row) || typeof row.label !== 'string' || typeof row.amount !== 'number') {
      return [];
    }
    const amountText = row.amount > 0 ? `+${row.amount}` : String(row.amount);
    if (row.rowKind === 'solar_power' && typeof row.solarPowerId === 'string') {
      return [{
        rowKind: 'solar_power',
        solarPowerId: row.solarPowerId,
        label: row.label,
        count: Number.isInteger(row.count) ? row.count : 1,
        amount: row.amount,
        amountText,
      } as BoardStatBreakdownRowVm];
    }
    if (row.rowKind === 'adjustment') {
      return [{ rowKind: 'adjustment', label: row.label, amount: row.amount, amountText }];
    }
    return [{
      rowKind: 'ship',
      label: row.label,
      ...(Number.isInteger(row.count) ? { count: row.count } : {}),
      amount: row.amount,
      amountText,
    }];
  });
}

function metric(
  input: MetricInput,
  turnNumber: number,
  source:
    | 'estimated'
    | 'turn_start_baseline'
    | 'privacy_frozen'
    | 'held_actual'
    | 'last_actual'
    | 'final_actual',
  fallback: 'pending' | 'unavailable' | 'concealed' = 'unavailable',
  unavailableReason?: string,
  estimateMode?: 'base' | 'with_autocast',
  chargeDeclarationUncertain = false,
  chargeDeclarationIdentity?: {
    declarationFingerprint: string;
    sourceContextKey: string;
  },
): ThisTurnMetricVm {
  if (!input) {
    return fallback === 'unavailable' && unavailableReason
      ? { state: fallback, turnNumber, reason: unavailableReason }
      : { state: fallback, turnNumber };
  }
  return {
    state: input.total === 0 ? 'zero' : 'value',
    turnNumber,
    source,
    ...(estimateMode ? { estimateMode } : {}),
    ...(chargeDeclarationUncertain ? { chargeDeclarationUncertain: true } : {}),
    ...(chargeDeclarationIdentity ? { chargeDeclarationIdentity } : {}),
    total: input.total,
    rows: input.rows,
  };
}

type NormalizedEstimate =
  | {
      status: 'estimated' | 'privacy_frozen';
      source: 'estimated' | 'turn_start_baseline' | 'privacy_frozen';
      estimateMode: 'base' | 'with_autocast';
      chargeDeclarationUncertain: boolean;
      chargeDeclarationIdentity?: {
        declarationFingerprint: string;
        sourceContextKey: string;
      };
      damage: MetricInput;
      healing: MetricInput;
    }
  | { status: 'unavailable'; reason?: string };

function estimateFor(
  value: unknown,
  sourceOverride?: 'turn_start_baseline',
  selectedMode: 'base' | 'with_autocast' | 'solar_selection' | 'charge_declaration' = 'base',
): NormalizedEstimate | null {
  if (!isRecord(value)) return null;
  if (value.status === 'unavailable') {
    return {
      status: 'unavailable',
      ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
    };
  }
  if (value.status !== 'estimated' && value.status !== 'privacy_frozen') return null;
  if (!isRecord(value.damage) || !isRecord(value.healing)) return null;
  if (typeof value.damage.total !== 'number' || typeof value.healing.total !== 'number') return null;
  const withAutocast = isRecord(value.withAutocast) &&
      isRecord(value.withAutocast.damage) &&
      isRecord(value.withAutocast.healing) &&
      typeof value.withAutocast.damage.total === 'number' &&
      typeof value.withAutocast.healing.total === 'number' &&
      Array.isArray(value.withAutocast.damage.rows) &&
      Array.isArray(value.withAutocast.healing.rows)
    ? value.withAutocast
    : null;
  const withSolarSelection = isRecord(value.withSolarSelection) &&
      isRecord(value.withSolarSelection.damage) &&
      isRecord(value.withSolarSelection.healing) &&
      typeof value.withSolarSelection.damage.total === 'number' &&
      typeof value.withSolarSelection.healing.total === 'number' &&
      Array.isArray(value.withSolarSelection.damage.rows) &&
      Array.isArray(value.withSolarSelection.healing.rows) &&
      typeof value.withSolarSelection.autocastEnabled === 'boolean'
    ? value.withSolarSelection
    : null;
  const withChargeDeclaration = isRecord(value.withChargeDeclaration) &&
      isRecord(value.withChargeDeclaration.damage) &&
      isRecord(value.withChargeDeclaration.healing) &&
      typeof value.withChargeDeclaration.damage.total === 'number' &&
      typeof value.withChargeDeclaration.healing.total === 'number' &&
      Array.isArray(value.withChargeDeclaration.damage.rows) &&
      Array.isArray(value.withChargeDeclaration.healing.rows) &&
      typeof value.withChargeDeclaration.autocastEnabled === 'boolean' &&
      typeof value.withChargeDeclaration.declarationFingerprint === 'string' &&
      isRecord(value.identity) &&
      typeof value.identity.declarationFingerprint === 'string' &&
      value.identity.declarationFingerprint ===
        value.withChargeDeclaration.declarationFingerprint &&
      typeof value.identity.sourceContextKey === 'string'
    ? value.withChargeDeclaration
    : null;
  if (selectedMode === 'charge_declaration' && !withChargeDeclaration) return null;
  const useChargeDeclaration =
    selectedMode === 'charge_declaration' && withChargeDeclaration !== null;
  const useSolarSelection =
    selectedMode === 'solar_selection' && withSolarSelection !== null;
  const useAutocast =
    selectedMode === 'with_autocast' && withAutocast !== null;
  const selected = useChargeDeclaration
    ? withChargeDeclaration
    : useSolarSelection
    ? withSolarSelection
    : useAutocast
      ? withAutocast
      : value;
  return {
    status: value.status,
    source: sourceOverride ?? value.status,
    estimateMode:
      useAutocast ||
        (useSolarSelection && withSolarSelection.autocastEnabled) ||
        (useChargeDeclaration && withChargeDeclaration.autocastEnabled)
        ? 'with_autocast'
        : 'base',
    chargeDeclarationUncertain:
      !useChargeDeclaration && value.chargeDeclarationUncertain === true,
    ...(useChargeDeclaration
      ? {
          chargeDeclarationIdentity: {
            declarationFingerprint: withChargeDeclaration.declarationFingerprint,
            sourceContextKey: value.identity.sourceContextKey,
          },
        }
      : {}),
    damage: { total: selected.damage.total, rows: normalizeRows(selected.damage.rows) },
    healing: { total: selected.healing.total, rows: normalizeRows(selected.healing.rows) },
  };
}

function matchingPreview(args: ThisTurnPresentationArgs): Extract<
  CurrentTurnPreviewState,
  { kind: 'estimated' | 'unavailable' | 'pending' }
> | null {
  if (
    (args.phaseKey !== 'build.drawing' &&
      args.phaseKey !== 'battle.charge_declaration') ||
    !args.activePreviewCandidate ||
    (args.preview.kind !== 'estimated' &&
      args.preview.kind !== 'unavailable' &&
      args.preview.kind !== 'pending')
  ) {
    return null;
  }
  const activeIdentity = getCurrentTurnPreviewCandidateIdentity(
    args.activePreviewCandidate,
  );
  return args.preview.candidate.identityKey === activeIdentity.identityKey
    ? args.preview
    : null;
}

function formatLocalDraftLines(
  draft: CanonicalBuildSubmitPayload,
  evolverConversions: readonly ProvisionalEvolverConversion[],
): string[] {
  return mergeOrderedRows(orderedLocalDraftRows(draft, 0, evolverConversions));
}

function rowUnit(
  source: ThisTurnBuildRowUnitVm['source'],
  lines: unknown,
  draftFingerprint?: string,
): ThisTurnBuildRowUnitVm | null {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const normalizedLines = lines.filter((line): line is string => typeof line === 'string');
  if (normalizedLines.length === 0) return null;
  return {
    source,
    ...(draftFingerprint ? { draftFingerprint } : {}),
    lines: mapBattleLogLines(normalizedLines, tokenizeBuildLine),
    hasShipBuildLine: normalizedLines.some(
      (line) => classifyBattleLogBuildLine(line) === 'ship',
    ),
    hasUnknownBuildLine: normalizedLines.some(
      (line) => classifyBattleLogBuildLine(line) === 'unknown',
    ),
  };
}

type OrderedBuildRow = {
  line: string;
  groupKey: string;
  appearanceAnchor: number;
  appearanceRank: number;
};

function normalizedOrderedRows(value: unknown): OrderedBuildRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): OrderedBuildRow[] => {
    if (
      !isRecord(row) || typeof row.line !== 'string' ||
      typeof row.groupKey !== 'string' ||
      !Number.isInteger(row.appearanceAnchor) ||
      !Number.isInteger(row.appearanceRank)
    ) return [];
    return [{
      line: row.line,
      groupKey: row.groupKey,
      appearanceAnchor: row.appearanceAnchor,
      appearanceRank: row.appearanceRank,
    }];
  });
}

function orderedLocalDraftRows(
  draft: CanonicalBuildSubmitPayload,
  captureSequence: number,
  evolverConversions: readonly ProvisionalEvolverConversion[] = [],
): OrderedBuildRow[] {
  const order = new Map(
    (draft.buildGroupOrder ?? []).map((entry, index, entries) => [
      entry.sourceShipDefId === 'EVO'
        ? `produced:${entry.shipDefId}:EVO`
        : `manual:${entry.shipDefId}`,
      {
        appearanceAnchor: entry.afterCaptureSequence,
        appearanceRank: entries.length - index,
      },
    ]),
  );
  const counts = Object.fromEntries(
    draft.builds.map((build) => [build.shipDefId, build.count]),
  );
  const rows = draft.builds.flatMap(({ shipDefId }, index): OrderedBuildRow[] => {
    const count = getManualBuildGroupCount(counts, shipDefId);
    if (count <= 0) return [];
    const appearance = order.get(`manual:${shipDefId}`) ?? {
      appearanceAnchor: captureSequence,
      appearanceRank: draft.builds.length - index,
    };
    return [{
      line: `${count} x ${shipDefId}`,
      groupKey: `manual:${shipDefId}`,
      ...appearance,
    }];
  });
  const zenCount = Number.isInteger(counts.ZEN) ? Math.max(0, counts.ZEN) : 0;
  const antCount = Number.isInteger(counts.ANT) ? Math.max(0, counts.ANT) : 0;
  const producedAntCount = Math.min(zenCount, antCount);
  if (producedAntCount > 0) {
    const zenAppearance = order.get('manual:ZEN') ?? {
      appearanceAnchor: captureSequence,
      appearanceRank: 0,
    };
    rows.push({
      line: `${producedAntCount} x ANT (${producedAntCount > 1 ? `${producedAntCount} ` : ''}ZEN)`,
      groupKey: 'produced:ANT:ZEN',
      appearanceAnchor: zenAppearance.appearanceAnchor,
      appearanceRank: zenAppearance.appearanceRank + 0.5,
    });
  }
  const evolverRows = new Map<
    ProvisionalEvolverConversion['shipDefId'],
    OrderedBuildRow & { count: number }
  >();
  for (const [index, conversion] of evolverConversions.entries()) {
    const groupKey = `produced:${conversion.shipDefId}:EVO`;
    const existing = evolverRows.get(conversion.shipDefId);
    if (existing) {
      existing.count += 1;
      existing.line = `${existing.count} x ${conversion.shipDefId} (${existing.count} EVO)`;
      continue;
    }
    const appearance = order.get(groupKey) ?? {
      appearanceAnchor: captureSequence + 1,
      appearanceRank: index + 1,
    };
    evolverRows.set(conversion.shipDefId, {
      line: `1 x ${conversion.shipDefId} (EVO)`,
      groupKey,
      ...appearance,
      count: 1,
    });
  }
  rows.push(...evolverRows.values());
  return rows;
}

function mergeOrderedRows(...sets: OrderedBuildRow[][]): string[] {
  const rows = new Map<string, OrderedBuildRow>();
  for (const set of sets) {
    for (const row of set) rows.set(row.groupKey, row);
  }
  return [...rows.values()]
    .sort((left, right) =>
      right.appearanceAnchor - left.appearanceAnchor ||
      right.appearanceRank - left.appearanceRank
    )
    .map((row) => row.line);
}

function validPublicThisTurn(value: unknown, args: ThisTurnPresentationArgs): Record<string, any> | null {
  if (!isRecord(value) || !isRecord(value.identity) || !isRecord(value.battleLog)) return null;
  return value.identity.gameId === args.gameId &&
      value.identity.turnNumber === args.turnNumber &&
      (value.identity.phaseKey == null || value.identity.phaseKey === args.phaseKey) &&
      value.battleLog.turnNumber === args.turnNumber
    ? value
    : null;
}

function buildLiveLog(args: ThisTurnPresentationArgs): ThisTurnLiveLogVm | null {
  if (args.isFinished) return null;
  const publicDto = validPublicThisTurn(args.publicThisTurn, args);
  if (!publicDto) return null;
  const battleLog = publicDto.battleLog;
  const publicBuilds = isRecord(battleLog.buildLinesByPlayerId)
    ? battleLog.buildLinesByPlayerId
    : {};
  const publicBattles = isRecord(battleLog.battleLinesByPlayerId)
    ? battleLog.battleLinesByPlayerId
    : {};
  const requester = isRecord(args.requesterThisTurn) ? args.requesterThisTurn : null;
  const isDrawing = args.phaseKey === 'build.drawing';
  const meUnits: ThisTurnBuildRowUnitVm[] = [];
  const opponentUnits: ThisTurnBuildRowUnitVm[] = [];
  const add = (target: ThisTurnBuildRowUnitVm[], unit: ThisTurnBuildRowUnitVm | null) => {
    if (unit) target.push(unit);
  };

  add(opponentUnits, rowUnit('public', args.opponentPlayerId ? publicBuilds[args.opponentPlayerId] : []));

  if (isDrawing && args.viewerRole === 'player') {
    const localEvolverConversions = args.localEvolverConversions ?? [];
    const committed = isRecord(requester?.committedProjection)
      ? requester.committedProjection
      : null;
    const committedBuild = isRecord(committed?.build) ? committed.build : null;
    if (committedBuild) {
      add(meUnits, rowUnit('canonical_committed', committedBuild.lines));
    } else {
      const draft = args.acceptedDraft ?? args.localDraft;
      const draftFingerprint = draft ? getCanonicalDraftFingerprint(draft) : undefined;
      const activePreview = matchingPreview(args);
      const canonicalPreview =
        activePreview?.kind === 'estimated' &&
        draftFingerprint === activePreview.candidate.draftFingerprint
          ? activePreview.estimate
          : null;
      if (canonicalPreview?.build) {
        add(
          meUnits,
          rowUnit('canonical_preview', canonicalPreview.build.lines, draftFingerprint),
        );
      } else if (draft) {
        const capturedRows = normalizedOrderedRows(requester?.capturedBuildRows);
        const captureSequence = Number.isInteger(requester?.captureSequence)
          ? Number(requester?.captureSequence)
          : 0;
        if (capturedRows.length > 0) {
          add(meUnits, rowUnit(
            'local_draft',
            mergeOrderedRows(
              capturedRows,
              orderedLocalDraftRows(draft, captureSequence, localEvolverConversions),
            ),
            draftFingerprint,
          ));
        } else {
          add(meUnits, rowUnit('public', args.mePlayerId ? publicBuilds[args.mePlayerId] : []));
          add(meUnits, rowUnit('requester_capture', requester?.capturedBuildLines));
          add(meUnits, rowUnit(
            'local_draft',
            formatLocalDraftLines(draft, localEvolverConversions),
            draftFingerprint,
          ));
        }
      }
    }
  } else {
    add(meUnits, rowUnit('public', args.mePlayerId ? publicBuilds[args.mePlayerId] : []));
  }

  const concealedIds = Array.isArray(battleLog.concealedBuildPlayerIds)
    ? battleLog.concealedBuildPlayerIds
    : [];
  const revealOpened = concealedIds.length === 0;
  const requesterCommitted = isRecord(requester?.committedProjection) &&
    isRecord(requester.committedProjection.build);
  return {
    turnNumber: args.turnNumber,
    diceValue: typeof battleLog.diceValue === 'number' ? battleLog.diceValue : null,
    lifecycle: 'live',
    me: {
      buildRowUnits: meUnits,
      battleLines: mapBattleLogLines(
        args.mePlayerId ? publicBattles[args.mePlayerId] : [],
        tokenizeBattleLine,
      ),
      buildVisibility:
        args.viewerRole === 'player'
          ? 'visible'
          : concealedIds.includes(args.mePlayerId) ? 'concealed' : 'visible',
      showSavedWhenEmpty:
        revealOpened || (isDrawing && (args.acceptedDraft !== null || requesterCommitted)),
    },
    opponent: {
      buildRowUnits: opponentUnits,
      battleLines: mapBattleLogLines(
        args.opponentPlayerId ? publicBattles[args.opponentPlayerId] : [],
        tokenizeBattleLine,
      ),
      buildVisibility: concealedIds.includes(args.opponentPlayerId) ? 'concealed' : 'visible',
      showSavedWhenEmpty: revealOpened,
    },
  };
}

function buildArchivedLog(
  args: ThisTurnPresentationArgs,
  turnNumber: number,
): ThisTurnLiveLogVm | null {
  const turn = args.history?.turns.find((candidate) => candidate.turnNumber === turnNumber);
  if (!turn) return null;
  const side = (playerId: string | null) => ({
    buildRowUnits: playerId
      ? [rowUnit('public', turn.buildLinesByPlayerId[playerId])].filter(
          (unit): unit is ThisTurnBuildRowUnitVm => unit !== null,
        )
      : [],
    battleLines: mapBattleLogLines(
      playerId ? turn.battleLinesByPlayerId[playerId] : [],
      tokenizeBattleLine,
    ),
    buildVisibility: 'visible' as const,
    showSavedWhenEmpty: true,
  });
  return {
    turnNumber,
    diceValue: turn.diceValue,
    lifecycle: 'archived',
    me: side(args.mePlayerId),
    opponent: side(args.opponentPlayerId),
  };
}

function currentMetrics(args: ThisTurnPresentationArgs): {
  me: { damage: ThisTurnMetricVm; healing: ThisTurnMetricVm };
  opponent: { damage: ThisTurnMetricVm; healing: ThisTurnMetricVm };
} {
  if (args.isFinished) {
    const unavailable = (): ThisTurnMetricVm => ({
      state: 'unavailable',
      turnNumber: args.turnNumber,
    });
    return {
      me: { damage: unavailable(), healing: unavailable() },
      opponent: { damage: unavailable(), healing: unavailable() },
    };
  }
  const isDrawing = args.phaseKey === 'build.drawing';
  const isChargeDeclaration = args.phaseKey === 'battle.charge_declaration';
  const beforeReveal = isDrawing || args.phaseKey === 'build.dice_roll' ||
    args.phaseKey === 'build.line_generation';
  const ownEstimateMode = args.ownEstimateMode ?? 'base';
  const publicDto = validPublicThisTurn(args.publicThisTurn, args);
  const publicEstimates = isRecord(publicDto?.estimatesByPlayerId)
    ? publicDto.estimatesByPlayerId
    : {};
  const requester = isRecord(args.requesterThisTurn) ? args.requesterThisTurn : null;
  const committed = estimateFor(
    requester?.committedProjection,
    undefined,
    ownEstimateMode,
  );
  const turnStart = estimateFor(
    requester?.turnStartProjection,
    'turn_start_baseline',
    ownEstimateMode,
  );
  const activePreview = matchingPreview(args);
  const preview = activePreview?.kind === 'estimated'
    ? estimateFor(activePreview.estimate, undefined, ownEstimateMode)
    : null;
  const requesterCurrent = estimateFor(
    requester?.currentProjection,
    undefined,
    ownEstimateMode,
  );
  const publicOwn = estimateFor(
    args.mePlayerId ? publicEstimates[args.mePlayerId] : null,
  );
  const chargePreview = activePreview?.kind === 'estimated'
    ? estimateFor(activePreview.estimate, undefined, 'charge_declaration')
    : null;
  const recoveredCharge = args.chargeDeclarationState?.kind === 'recovered'
    ? estimateFor(requester?.currentProjection, undefined, 'charge_declaration')
    : null;
  const chargeOwn = args.viewerRole !== 'player'
    ? publicOwn
    : args.chargeDeclarationState?.kind === 'recovered'
      ? recoveredCharge
      : args.chargeDeclarationState?.kind === 'editing'
        ? chargePreview
        : null;
  const own = args.viewerRole !== 'player'
    ? publicOwn
    : isDrawing
    ? committed ?? preview ?? turnStart
    : isChargeDeclaration
      ? chargeOwn
    : args.viewerRole === 'player' && ownEstimateMode === 'solar_selection'
      ? preview ?? requesterCurrent
    : args.viewerRole === 'player' && ownEstimateMode === 'with_autocast'
      ? requesterCurrent
      : publicOwn;
  const opponent = estimateFor(
    args.opponentPlayerId ? publicEstimates[args.opponentPlayerId] : null,
  );
  const ownAvailable = own?.status === 'estimated' || own?.status === 'privacy_frozen'
    ? own
    : null;
  const opponentAvailable =
    opponent?.status === 'estimated' || opponent?.status === 'privacy_frozen'
      ? opponent
      : null;
  const chargeUnavailableReason = args.chargeDeclarationState?.kind === 'incomplete'
    ? args.chargeDeclarationState.reason
    : args.chargeDeclarationState?.kind === 'recovered' && !recoveredCharge
      ? 'invalid_recovered_charge_declaration'
      : undefined;
  const ownFallback = beforeReveal && args.viewerRole !== 'player'
    ? 'concealed'
    : isChargeDeclaration && args.viewerRole === 'player' && chargeUnavailableReason
      ? 'unavailable'
    : own?.status === 'unavailable' || activePreview?.kind === 'unavailable'
      ? 'unavailable'
      : 'pending';
  const opponentFallback = beforeReveal
    ? 'concealed'
    : opponent?.status === 'unavailable'
      ? 'unavailable'
      : 'pending';
  const ownSource = ownAvailable?.source ?? 'estimated';
  const opponentSource = opponentAvailable?.source ?? 'estimated';
  const ownUnavailableReason = own?.status === 'unavailable'
    ? own.reason
    : chargeUnavailableReason
      ? chargeUnavailableReason
    : activePreview?.kind === 'unavailable'
      ? activePreview.reason
      : undefined;
  const opponentUnavailableReason = opponent?.status === 'unavailable'
    ? opponent.reason
    : undefined;
  const fresh = {
    me: {
      damage: metric(
        ownAvailable?.damage ?? null,
        args.turnNumber,
        ownSource,
        ownFallback,
        ownUnavailableReason,
        ownAvailable?.estimateMode,
        args.viewerRole !== 'player' && ownAvailable?.chargeDeclarationUncertain === true,
        ownAvailable?.chargeDeclarationIdentity,
      ),
      healing: metric(
        ownAvailable?.healing ?? null,
        args.turnNumber,
        ownSource,
        ownFallback,
        ownUnavailableReason,
        ownAvailable?.estimateMode,
        args.viewerRole !== 'player' && ownAvailable?.chargeDeclarationUncertain === true,
        ownAvailable?.chargeDeclarationIdentity,
      ),
    },
    opponent: {
      damage: metric(
        opponentAvailable?.damage ?? null,
        args.turnNumber,
        opponentSource,
        opponentFallback,
        opponentUnavailableReason,
        opponentAvailable?.estimateMode,
        opponentAvailable?.chargeDeclarationUncertain === true,
        opponentAvailable?.chargeDeclarationIdentity,
      ),
      healing: metric(
        opponentAvailable?.healing ?? null,
        args.turnNumber,
        opponentSource,
        opponentFallback,
        opponentUnavailableReason,
        opponentAvailable?.estimateMode,
        opponentAvailable?.chargeDeclarationUncertain === true,
        opponentAvailable?.chargeDeclarationIdentity,
      ),
    },
  };

  return {
    me: {
      damage: retainSafeCurrentMetric(
        args,
        args.mePlayerId,
        'damage',
        fresh.me.damage,
        isChargeDeclaration ? 'charge_declaration' : ownEstimateMode,
      ),
      healing: retainSafeCurrentMetric(
        args,
        args.mePlayerId,
        'healing',
        fresh.me.healing,
        isChargeDeclaration ? 'charge_declaration' : ownEstimateMode,
      ),
    },
    opponent: {
      damage: retainSafeCurrentMetric(
        args,
        args.opponentPlayerId,
        'damage',
        fresh.opponent.damage,
        'base',
      ),
      healing: retainSafeCurrentMetric(
        args,
        args.opponentPlayerId,
        'healing',
        fresh.opponent.healing,
        'base',
      ),
    },
  };
}

function retainSafeCurrentMetric(
  args: ThisTurnPresentationArgs,
  playerId: string | null,
  metricKey: 'damage' | 'healing',
  fresh: ThisTurnMetricVm,
  selectedMode: 'base' | 'with_autocast' | 'solar_selection' | 'charge_declaration',
): ThisTurnMetricVm {
  if (
    fresh.state === 'zero' ||
    fresh.state === 'value' ||
    fresh.state === 'concealed' ||
    !playerId
  ) {
    return fresh;
  }

  const previous = args.previousPresentation;
  if (
    !previous ||
    previous.gameId !== args.gameId ||
    previous.presentation.turnNumber !== args.turnNumber
  ) {
    return fresh;
  }

  const previousPlayer = [
    previous.presentation.me,
    previous.presentation.opponent,
  ].find((candidate) => candidate.playerId === playerId);
  const previousMetric = previousPlayer?.[metricKey].current;

  const isPublicMetric = args.viewerRole !== 'player' || playerId !== args.mePlayerId;
  if (isPublicMetric && (
    !validPublicThisTurn(args.publicThisTurn, args) ||
    fresh.state === 'unavailable' ||
    previous.presentation.phaseKey !== args.phaseKey ||
    !previousMetric ||
    (previousMetric.state !== 'zero' && previousMetric.state !== 'value') ||
    previousMetric.chargeDeclarationUncertain !== true
  )) {
    return fresh;
  }
  if (!isPublicMetric && previousMetric &&
    (previousMetric.state === 'zero' || previousMetric.state === 'value') &&
    previousMetric.chargeDeclarationUncertain === true
  ) {
    return fresh;
  }

  if (selectedMode === 'charge_declaration') {
    if (
      !args.activePreviewCandidate ||
      args.activePreviewCandidate.phaseKey !== 'battle.charge_declaration'
    ) {
      return fresh;
    }
    const activeIdentity = getCurrentTurnPreviewCandidateIdentity(
      args.activePreviewCandidate,
    );
    const previousIdentity =
      previousMetric &&
      (previousMetric.state === 'zero' || previousMetric.state === 'value')
        ? previousMetric.chargeDeclarationIdentity
        : undefined;
    if (
      previousIdentity?.declarationFingerprint !==
        activeIdentity.declarationFingerprint ||
      previousIdentity?.sourceContextKey !==
        args.activePreviewCandidate.safeContextFingerprint
    ) {
      return fresh;
    }
  }

  if (
    selectedMode !== 'charge_declaration' &&
    previousMetric &&
    (previousMetric.state === 'zero' || previousMetric.state === 'value') &&
    (previousMetric.estimateMode ?? 'base') !== selectedMode
  ) {
    return fresh;
  }

  return previousMetric &&
      previousMetric.turnNumber === args.turnNumber &&
      (previousMetric.state === 'zero' || previousMetric.state === 'value')
    ? previousMetric
    : fresh;
}

function withLast(
  playerId: string | null,
  current: { damage: ThisTurnMetricVm; healing: ThisTurnMetricVm },
  last: LastTurnPresentationInput['me'],
  lastTurnNumber: number,
): ThisTurnPlayerMetricsVm {
  return {
    playerId,
    damage: {
      current: current.damage,
      last: metric(last.damage, lastTurnNumber, 'last_actual'),
    },
    healing: {
      current: current.healing,
      last: metric(last.healing, lastTurnNumber, 'last_actual'),
    },
  };
}

export function buildThisTurnPresentation(args: ThisTurnPresentationArgs): ThisTurnPresentationVm {
  const archivedHeldTurn = args.resolutionSnapshot &&
    args.history?.turns.some(
      (turn) => turn.turnNumber === args.resolutionSnapshot!.resolvedTurnNumber,
    );
  if (args.resolutionSnapshot?.gameId === args.gameId &&
      args.resolutionSnapshot.me.playerId === args.mePlayerId &&
      args.resolutionSnapshot.opponent.playerId === args.opponentPlayerId &&
      (!args.isFinished || (args.resolutionSnapshot.isTerminalTurn &&
        args.resolutionSnapshot.resolvedTurnNumber === args.turnNumber))) {
    return {
      turnNumber: args.resolutionSnapshot.resolvedTurnNumber,
      phaseKey: args.phaseKey,
      liveLog: archivedHeldTurn
        ? buildArchivedLog(args, args.resolutionSnapshot.resolvedTurnNumber)
        : args.resolutionSnapshot.liveLog,
      me: args.resolutionSnapshot.me,
      opponent: args.resolutionSnapshot.opponent,
      archiveHandoff:
        !archivedHeldTurn &&
        args.archiveRecovery?.turnNumber === args.resolutionSnapshot.resolvedTurnNumber
          ? args.archiveRecovery
          : null,
      mobile: {
        pairKey: `${args.gameId}::${args.resolutionSnapshot.resolvedTurnNumber}::held`,
        opponentDetail: 'this_turn',
      },
    };
  }

  const current = currentMetrics(args);
  const me = withLast(
    args.mePlayerId,
    current.me,
    args.lastTurn.me,
    args.lastTurn.turnNumber,
  );
  const opponent = withLast(
    args.opponentPlayerId,
    current.opponent,
    args.lastTurn.opponent,
    args.lastTurn.turnNumber,
  );
  return {
    turnNumber: args.turnNumber,
    phaseKey: args.phaseKey,
    liveLog: buildLiveLog(args),
    me,
    opponent,
    archiveHandoff: args.archiveRecovery,
    mobile: {
      pairKey: `${args.gameId}::${args.turnNumber}`,
      opponentDetail: 'this_turn',
    },
  };
}

export function buildResolvedThisTurnSnapshot(args: {
  gameId: string;
  resolvedTurnNumber: number;
  isTerminalTurn: boolean;
  mePlayerId: string | null;
  opponentPlayerId: string | null;
  actualMe: { damage: MetricInput; healing: MetricInput };
  actualOpponent: { damage: MetricInput; healing: MetricInput };
  previous: ThisTurnPresentationVm;
}): ThisTurnResolutionSnapshot {
  const source = args.isTerminalTurn ? 'final_actual' : 'held_actual';
  const makePlayer = (
    playerId: string | null,
    actual: { damage: MetricInput; healing: MetricInput },
    previous: ThisTurnPlayerMetricsVm,
  ): ThisTurnPlayerMetricsVm => ({
    playerId,
    damage: {
      current: metric(actual.damage, args.resolvedTurnNumber, source),
      last: previous.damage.last,
    },
    healing: {
      current: metric(actual.healing, args.resolvedTurnNumber, source),
      last: previous.healing.last,
    },
  });
  return {
    gameId: args.gameId,
    resolvedTurnNumber: args.resolvedTurnNumber,
    isTerminalTurn: args.isTerminalTurn,
    me: makePlayer(args.mePlayerId, args.actualMe, args.previous.me),
    opponent: makePlayer(args.opponentPlayerId, args.actualOpponent, args.previous.opponent),
    liveLog: args.previous.liveLog
      ? { ...args.previous.liveLog, lifecycle: 'held' }
      : null,
  };
}
