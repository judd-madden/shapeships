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
import {
  mapBattleLogThisTurn,
  mapBattleLogTurns,
} from '../../gameSession/battleLog';

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
    resolutionSnapshot: overrides.resolutionSnapshot ?? null,
    history: overrides.history ?? null,
    archiveRecovery: overrides.archiveRecovery ?? null,
  });
}

function lineText(lines: Array<{ tokens: Array<{ text: string }> }>): string[] {
  return lines.map((line) => line.tokens.map((token) => token.text).join(''));
}

function historyFor(turnNumber: number) {
  return {
    gameId: 'game-1',
    revision: 1,
    completedTurnCount: 1,
    turns: [{
      turnNumber,
      diceValue: 3,
      players: [
        { playerId: 'p1', name: 'One', healthEnd: 25, healthDelta: 0, fleetValueEnd: 3 },
        { playerId: 'p2', name: 'Two', healthEnd: 23, healthDelta: -2, fleetValueEnd: 2 },
      ],
      buildLinesByPlayerId: { p1: ['1 x FIG'], p2: ['1 x DEF'] },
      battleLinesByPlayerId: { p1: ['FIG damages DEF'], p2: [] },
    }],
  };
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
  const card = mapBattleLogThisTurn(canonical);
  assert(card !== null);
  assert(
    JSON.stringify(lineText(card.me.buildLines)) ===
      JSON.stringify(['FIG', 'Intervention: 1 x FIG', 'FIG (DEF)', 'EVO']),
    'display mapping did not preserve the composed unit order',
  );
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

Deno.test('live card keeps public concealed rows before the placeholder and actions separate', () => {
  const presentation = base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    publicThisTurn: {
      identity: { gameId: 'game-1', turnNumber: 4 },
      battleLog: {
        turnNumber: 4,
        diceValue: 3,
        buildLinesByPlayerId: {
          p1: [],
          p2: ['CHR rolled 3 3'],
        },
        battleLinesByPlayerId: {
          p1: ['FIG damages DEF'],
          p2: [],
        },
        concealedBuildPlayerIds: ['p2'],
      },
      estimatesByPlayerId: {},
    },
    requesterThisTurn: null,
    localDraft: { builds: [] },
  });
  const card = mapBattleLogThisTurn(presentation);
  assert(card !== null);
  assert(card.showBattleSection, 'public battle action section was omitted');
  assert(card.showBuildSection, 'concealed build section was omitted');
  assert(
    JSON.stringify(lineText(card.opponent.buildLines)) ===
      JSON.stringify(['CHR rolled 3 3', '???']),
    'concealed placeholder did not follow public opponent rows',
  );
  assert(JSON.stringify(lineText(card.me.battleLines)) === JSON.stringify(['FIG damages DEF']));
});

Deno.test('an empty live projection still maps to a card and suppresses the empty state', () => {
  const presentation = base({ kind: 'idle' }, 'build.reveal', 'player', false, {
    publicThisTurn: {
      identity: { gameId: 'game-1', turnNumber: 4 },
      battleLog: {
        turnNumber: 4,
        diceValue: 3,
        buildLinesByPlayerId: { p1: [], p2: [] },
        battleLinesByPlayerId: { p1: [], p2: [] },
        concealedBuildPlayerIds: [],
      },
      estimatesByPlayerId: {},
    },
  });
  const card = mapBattleLogThisTurn(presentation);
  assert(card !== null);
  assert(!card.showBattleSection && !card.showBuildSection);
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

Deno.test('held live N swaps atomically to genuine archive N', () => {
  const previous = base({ kind: 'idle' });
  const snapshot = buildResolvedThisTurnSnapshot({
    gameId: 'game-1', resolvedTurnNumber: 4, isTerminalTurn: false,
    mePlayerId: 'p1', opponentPlayerId: 'p2', previous,
    actualMe: { damage: { total: 2, rows: [] }, healing: { total: 0, rows: [] } },
    actualOpponent: { damage: { total: 1, rows: [] }, healing: { total: 0, rows: [] } },
  });
  const held = base({ kind: 'idle' }, 'battle.end_of_turn_resolution', 'player', false, {
    resolutionSnapshot: snapshot,
    archiveRecovery: { turnNumber: 4, state: 'pending' },
  });
  assert(mapBattleLogThisTurn(held)?.turnNumber === 4, 'held live card disappeared before archive');

  const history = historyFor(4);
  const archived = base({ kind: 'idle' }, 'battle.end_of_turn_resolution', 'player', false, {
    resolutionSnapshot: snapshot,
    history,
  });
  const mapped = mapBattleLogTurns({
    battleLogHistory: history,
    thisTurn: archived,
    localPlayerId: 'p1',
    localPlayerName: 'One',
    opponentPlayerId: 'p2',
    opponentName: 'Two',
  });
  assert(mapped.battleLogThisTurn === null, 'archived lifecycle remained visible as This Turn');
  assert(mapped.battleLogTurns.length === 1 && mapped.battleLogTurns[0]?.turnNumber === 4);
  assert(mapped.battleLogCompletedTurnCount === 1);
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

Deno.test('released N+1 silently defers missing archive N without fabricating history', () => {
  const vm = base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    turnNumber: 5,
    activePreviewCandidate: previewCandidate({ turnNumber: 5 }),
    archiveRecovery: { turnNumber: 4, state: 'deferred' },
  });
  const mapped = mapBattleLogTurns({
    battleLogHistory: null,
    thisTurn: vm,
    localPlayerId: 'p1',
    localPlayerName: 'One',
    opponentPlayerId: 'p2',
    opponentName: 'Two',
  });
  assert(mapped.battleLogThisTurn?.turnNumber === 5);
  assert(mapped.battleLogTurns.length === 0, 'missing archive was fabricated from live rows');
  assert(mapped.battleLogCompletedTurnCount === 0);
});

Deno.test('terminal completion without resolution leaves only genuine history', () => {
  const finished = base({ kind: 'idle' }, 'game.finished', 'player', true);
  const history = historyFor(3);
  const mapped = mapBattleLogTurns({
    battleLogHistory: history,
    thisTurn: finished,
    localPlayerId: 'p1',
    localPlayerName: 'One',
    opponentPlayerId: 'p2',
    opponentName: 'Two',
  });
  assert(mapped.battleLogThisTurn === null);
  assert(mapped.battleLogTurns.length === 1 && mapped.battleLogTurns[0]?.turnNumber === 3);
});
