declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  buildResolvedThisTurnSnapshot,
  buildThisTurnPresentation,
} from '../../gameSession/thisTurnPresentation';
import {
  getCurrentTurnPreviewCandidateIdentity,
  type CurrentTurnPreviewCandidateInput,
  type CurrentTurnPreviewState,
} from '../../gameSession/currentTurnPreview';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

const defaultDraft = {
  builds: [{ shipDefId: 'FIG', count: 1 }, { shipDefId: 'EVO', count: 1 }],
};

function previewCandidate(
  overrides: Partial<CurrentTurnPreviewCandidateInput> = {},
): CurrentTurnPreviewCandidateInput {
  return {
    gameId: 'game-1',
    playerId: 'p1',
    turnNumber: 4,
    phaseKey: 'build.drawing',
    safeContextFingerprint: 'safe',
    draft: defaultDraft,
    ...overrides,
  };
}

function schedulerCandidate(
  input: CurrentTurnPreviewCandidateInput,
  generation = 1,
) {
  const identity = getCurrentTurnPreviewCandidateIdentity(input);
  return {
    ...input,
    ...identity,
    generation,
    requestToken: `${input.turnNumber}.${generation}`,
  };
}

function base(
  preview: CurrentTurnPreviewState,
  phaseKey = 'build.drawing',
  viewerRole: 'player' | 'spectator' = 'player',
  isFinished = false,
  overrides: Record<string, any> = {},
) {
  const turnNumber = overrides.turnNumber ?? 4;
  const gameId = overrides.gameId ?? 'game-1';
  const mePlayerId = overrides.mePlayerId ?? 'p1';
  const localDraft = overrides.localDraft ?? defaultDraft;
  const activePreviewCandidate = Object.prototype.hasOwnProperty.call(
    overrides,
    'activePreviewCandidate',
  )
    ? overrides.activePreviewCandidate
    : phaseKey === 'build.drawing' && viewerRole === 'player'
      ? previewCandidate({ gameId, playerId: mePlayerId, turnNumber, draft: localDraft })
      : null;
  return buildThisTurnPresentation({
    gameId, turnNumber, phaseKey, isFinished,
    viewerRole, mePlayerId, opponentPlayerId: overrides.opponentPlayerId ?? 'p2',
    localDraft,
    acceptedDraft: overrides.acceptedDraft ?? null,
    activePreviewCandidate,
    preview,
    publicThisTurn: overrides.publicThisTurn ?? {
      identity: { gameId, turnNumber },
      battleLog: {
        turnNumber, diceValue: 3,
        buildLinesByPlayerId: { p1: ['1 x FIG'] }, battleLinesByPlayerId: {}, concealedBuildPlayerIds: ['p2'],
      },
      estimatesByPlayerId: {},
    },
    requesterThisTurn: overrides.requesterThisTurn ?? {
      capturedBuildLines: ['Intervention: 1 x FIG'], committedProjection: null,
    },
    lastTurn: overrides.lastTurn ?? {
      turnNumber: 3,
      me: { damage: { total: 0, rows: [] }, healing: null },
      opponent: { damage: null, healing: { total: 2, rows: [] } },
    },
    resolutionSnapshot: null, history: null, archiveRecovery: null,
  });
}

Deno.test('matching canonical draft replaces the whole local unit without text deduplication', () => {
  const candidate = schedulerCandidate(previewCandidate(), 2);
  const idle = base({ kind: 'idle' });
  assert(idle.liveLog?.me.buildRowUnits.some((unit) => unit.source === 'local_draft'));
  const canonical = base({
    kind: 'estimated', candidate,
    estimate: {
      status: 'estimated', requestToken: '4.1',
      identity: { gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing', sourceContextKey: 'route', draftKey: 'draft' },
      playerId: 'p1', damage: { total: 2, rows: [] }, healing: { total: 0, rows: [] },
      build: { lines: ['1 x FIG (1 DEF)', '1 x EVO'], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
    },
  });
  const units = canonical.liveLog?.me.buildRowUnits ?? [];
  assert(!units.some((unit) => unit.source === 'local_draft'), 'local unit survived canonical replacement');
  assert(units.some((unit) => unit.source === 'canonical_preview'), 'canonical unit absent');
  assert(units.some((unit) => unit.source === 'public'), 'equal-looking public row was deduplicated');
  assert(units.some((unit) => unit.source === 'requester_capture'), 'captured intervention row was merged into draft');
  assert(canonical.me.damage.current.state === 'value');
  assert(canonical.me.damage.last.state === 'zero');
  assert(canonical.opponent.damage.current.state === 'concealed');
});

Deno.test('rows and metrics reject stale preview identity before pending publishes', () => {
  const originalInput = previewCandidate();
  const original = schedulerCandidate(originalInput);
  const stalePreview: CurrentTurnPreviewState = {
    kind: 'estimated',
    candidate: original,
    estimate: {
      status: 'estimated', requestToken: original.requestToken,
      identity: { gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing', sourceContextKey: 'route', draftKey: 'draft' },
      playerId: 'p1', damage: { total: 9, rows: [] }, healing: { total: 2, rows: [] },
      build: { lines: ['canonical old draft'], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
    },
  };
  const cases: Array<{ label: string; overrides: Record<string, any> }> = [
    {
      label: 'draft edit',
      overrides: {
        localDraft: { builds: [{ shipDefId: 'FIG', count: 2 }] },
        activePreviewCandidate: previewCandidate({ draft: { builds: [{ shipDefId: 'FIG', count: 2 }] } }),
      },
    },
    {
      label: 'safe context',
      overrides: { activePreviewCandidate: previewCandidate({ safeContextFingerprint: 'safe-new' }) },
    },
    {
      label: 'turn',
      overrides: {
        turnNumber: 5,
        activePreviewCandidate: previewCandidate({ turnNumber: 5 }),
      },
    },
    {
      label: 'player',
      overrides: {
        mePlayerId: 'p9',
        activePreviewCandidate: previewCandidate({ playerId: 'p9' }),
      },
    },
    {
      label: 'game',
      overrides: {
        gameId: 'game-2',
        activePreviewCandidate: previewCandidate({ gameId: 'game-2' }),
      },
    },
  ];
  for (const testCase of cases) {
    const vm = base(stalePreview, 'build.drawing', 'player', false, testCase.overrides);
    assert(vm.me.damage.current.state === 'pending', `${testCase.label} reused stale metrics`);
    assert(
      !vm.liveLog?.me.buildRowUnits.some((unit) => unit.source === 'canonical_preview'),
      `${testCase.label} reused stale canonical rows`,
    );
  }
});

Deno.test('cached preview identity is valid even when response token belongs to its old generation', () => {
  const input = previewCandidate();
  const candidate = schedulerCandidate(input, 3);
  const vm = base({
    kind: 'estimated', candidate,
    estimate: {
      status: 'estimated', requestToken: '4.1',
      identity: { gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing', sourceContextKey: 'route', draftKey: 'draft' },
      playerId: 'p1', damage: { total: 4, rows: [] }, healing: { total: 0, rows: [] },
      build: { lines: ['cached canonical'], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
    },
  });
  assert(vm.me.damage.current.state === 'value');
  assert(vm.liveLog?.me.buildRowUnits.some((unit) => unit.source === 'canonical_preview'));
});

Deno.test('identical empty draft does not cross a turn boundary', () => {
  const emptyDraft = { builds: [] };
  const oldInput = previewCandidate({ turnNumber: 4, draft: emptyDraft });
  const oldCandidate = schedulerCandidate(oldInput);
  const vm = base({
    kind: 'estimated',
    candidate: oldCandidate,
    estimate: {
      status: 'estimated', requestToken: oldCandidate.requestToken,
      identity: { gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing', sourceContextKey: 'route', draftKey: 'empty' },
      playerId: 'p1', damage: { total: 5, rows: [] }, healing: { total: 0, rows: [] },
      build: { lines: [], skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0 },
    },
  }, 'build.drawing', 'player', false, {
    turnNumber: 5,
    localDraft: emptyDraft,
    activePreviewCandidate: previewCandidate({ turnNumber: 5, draft: emptyDraft }),
  });
  assert(vm.me.damage.current.state === 'pending');
});

Deno.test('authoritative unavailable and privacy frozen statuses remain explicit', () => {
  const publicBase = {
    identity: { gameId: 'game-1', turnNumber: 4 },
    battleLog: {
      turnNumber: 4, diceValue: 3, buildLinesByPlayerId: {}, battleLinesByPlayerId: {}, concealedBuildPlayerIds: [],
    },
  };
  const unavailable = base({ kind: 'idle' }, 'build.reveal', 'player', false, {
    publicThisTurn: {
      ...publicBase,
      estimatesByPlayerId: {
        p1: { status: 'unavailable', reason: 'turn_already_resolved' },
        p2: { status: 'estimated', damage: { total: 1, rows: [] }, healing: { total: 0, rows: [] } },
      },
    },
  });
  assert(unavailable.me.damage.current.state === 'unavailable');
  if (unavailable.me.damage.current.state === 'unavailable') {
    assert(unavailable.me.damage.current.reason === 'turn_already_resolved');
  }
  assert(unavailable.opponent.damage.current.state === 'value');

  const bothUnavailable = base({ kind: 'idle' }, 'build.reveal', 'player', false, {
    publicThisTurn: {
      ...publicBase,
      estimatesByPlayerId: {
        p1: { status: 'unavailable', reason: 'unsupported_phase' },
        p2: { status: 'unavailable', reason: 'turn_already_resolved' },
      },
    },
  });
  assert(bothUnavailable.me.healing.current.state === 'unavailable');
  assert(bothUnavailable.opponent.healing.current.state === 'unavailable');

  const frozen = base({ kind: 'idle' }, 'battle.charge_declaration', 'player', false, {
    publicThisTurn: {
      ...publicBase,
      estimatesByPlayerId: {
        p1: { status: 'privacy_frozen', damage: { total: 3, rows: [] }, healing: { total: 1, rows: [] } },
        p2: { status: 'privacy_frozen', damage: { total: 2, rows: [] }, healing: { total: 0, rows: [] } },
      },
    },
  });
  assert(frozen.me.damage.current.state === 'value' && frozen.me.damage.current.source === 'privacy_frozen');
  assert(frozen.opponent.damage.current.state === 'value' && frozen.opponent.damage.current.source === 'privacy_frozen');
});

Deno.test('Reveal uses only the authoritative public build projection', () => {
  const reveal = base({ kind: 'idle' }, 'build.reveal');
  const sources = reveal.liveLog?.me.buildRowUnits.map((unit) => unit.source) ?? [];
  assert(JSON.stringify(sources) === JSON.stringify(['public']));
});

Deno.test('spectators stay concealed during Drawing and unresolved terminal data is unavailable', () => {
  const spectator = base({ kind: 'idle' }, 'build.drawing', 'spectator');
  assert(spectator.me.damage.current.state === 'concealed');
  assert(spectator.opponent.damage.current.state === 'concealed');
  const terminal = base({ kind: 'idle' }, 'game.finished', 'player', true);
  assert(terminal.liveLog === null);
  assert(terminal.me.damage.current.state === 'unavailable');
});

Deno.test('resolved snapshot keeps previous Last while actual N replaces current estimates', () => {
  const previous = base({ kind: 'idle' });
  const snapshot = buildResolvedThisTurnSnapshot({
    gameId: 'game-1', resolvedTurnNumber: 4, isTerminalTurn: false,
    mePlayerId: 'p1', opponentPlayerId: 'p2', previous,
    actualMe: {
      damage: { total: 7, rows: [] }, healing: { total: 1, rows: [] },
    },
    actualOpponent: {
      damage: { total: 3, rows: [] }, healing: { total: 0, rows: [] },
    },
  });
  assert(snapshot.me.damage.current.state === 'value' && snapshot.me.damage.current.total === 7);
  assert(snapshot.me.damage.last.state === 'zero' && snapshot.me.damage.last.turnNumber === 3);
  assert(snapshot.liveLog?.turnNumber === 4 && snapshot.liveLog.lifecycle === 'held');
});

Deno.test('released presentation selects live N+1 with actual N in Last', () => {
  const vm = base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    turnNumber: 5,
    activePreviewCandidate: previewCandidate({ turnNumber: 5 }),
    lastTurn: {
      turnNumber: 4,
      me: {
        damage: { total: 7, rows: [] },
        healing: { total: 1, rows: [] },
      },
      opponent: {
        damage: { total: 3, rows: [] },
        healing: { total: 0, rows: [] },
      },
    },
  });
  assert(vm.turnNumber === 5);
  assert(vm.me.damage.last.state === 'value' && vm.me.damage.last.turnNumber === 4);
  if (vm.me.damage.last.state === 'value') assert(vm.me.damage.last.total === 7);
});
