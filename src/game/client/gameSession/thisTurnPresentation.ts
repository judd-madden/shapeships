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
  ownEstimateMode?: 'base' | 'with_autocast';
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
    total: input.total,
    rows: input.rows,
  };
}

type NormalizedEstimate =
  | {
      status: 'estimated' | 'privacy_frozen';
      source: 'estimated' | 'turn_start_baseline' | 'privacy_frozen';
      estimateMode: 'base' | 'with_autocast';
      damage: MetricInput;
      healing: MetricInput;
    }
  | { status: 'unavailable'; reason?: string };

function estimateFor(
  value: unknown,
  sourceOverride?: 'turn_start_baseline',
  selectedMode: 'base' | 'with_autocast' = 'base',
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
  const useAutocast = selectedMode === 'with_autocast' && withAutocast !== null;
  const selected = useAutocast ? withAutocast : value;
  return {
    status: value.status,
    source: sourceOverride ?? value.status,
    estimateMode: useAutocast ? 'with_autocast' : 'base',
    damage: { total: selected.damage.total, rows: normalizeRows(selected.damage.rows) },
    healing: { total: selected.healing.total, rows: normalizeRows(selected.healing.rows) },
  };
}

function matchingPreview(args: ThisTurnPresentationArgs): Extract<
  CurrentTurnPreviewState,
  { kind: 'estimated' | 'unavailable' | 'pending' }
> | null {
  if (
    args.phaseKey !== 'build.drawing' ||
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
      if (canonicalPreview) {
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
  const own = isDrawing
    ? args.viewerRole === 'player' ? committed ?? preview ?? turnStart : null
    : args.viewerRole === 'player' && ownEstimateMode === 'with_autocast'
      ? requesterCurrent
      : publicOwn;
  const opponent = isDrawing ? null : estimateFor(
    args.opponentPlayerId ? publicEstimates[args.opponentPlayerId] : null,
  );
  const ownAvailable = own?.status === 'estimated' || own?.status === 'privacy_frozen'
    ? own
    : null;
  const opponentAvailable =
    opponent?.status === 'estimated' || opponent?.status === 'privacy_frozen'
      ? opponent
      : null;
  const ownFallback = isDrawing && args.viewerRole !== 'player'
    ? 'concealed'
    : own?.status === 'unavailable' || activePreview?.kind === 'unavailable'
      ? 'unavailable'
      : 'pending';
  const opponentFallback = isDrawing
    ? 'concealed'
    : opponent?.status === 'unavailable'
      ? 'unavailable'
      : 'pending';
  const ownSource = ownAvailable?.source ?? 'estimated';
  const opponentSource = opponentAvailable?.source ?? 'estimated';
  const ownUnavailableReason = own?.status === 'unavailable'
    ? own.reason
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
      ),
      healing: metric(
        ownAvailable?.healing ?? null,
        args.turnNumber,
        ownSource,
        ownFallback,
        ownUnavailableReason,
        ownAvailable?.estimateMode,
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
      ),
      healing: metric(
        opponentAvailable?.healing ?? null,
        args.turnNumber,
        opponentSource,
        opponentFallback,
        opponentUnavailableReason,
        opponentAvailable?.estimateMode,
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
        ownEstimateMode,
      ),
      healing: retainSafeCurrentMetric(
        args,
        args.mePlayerId,
        'healing',
        fresh.me.healing,
        ownEstimateMode,
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
  selectedMode: 'base' | 'with_autocast',
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

  if (
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
  if (args.resolutionSnapshot?.gameId === args.gameId) {
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
      opponentDetail: args.phaseKey === 'build.drawing' ? 'last' : 'this_turn',
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
