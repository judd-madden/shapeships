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
    localEvolverConversions: overrides.localEvolverConversions ?? [],
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

Deno.test('matching canonical preview replaces the complete own ledger without source concatenation', () => {
  const candidate = schedulerCandidate(previewCandidate(), 2);
  const idle = base({ kind: 'idle' });
  assert(idle.liveLog?.me.buildRowUnits.some((unit) => unit.source === 'local_draft'));
  const canonical = base({
    kind: 'estimated', candidate,
    estimate: {
      status: 'estimated', requestToken: '4.1',
      identity: { gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing', sourceContextKey: 'route', draftKey: 'draft' },
      playerId: 'p1', damage: { total: 2, rows: [] }, healing: { total: 0, rows: [] },
      build: {
        lines: ['1 x EVO', 'Intervention: 1 x FIG', '1 x FIG (1 DEF)'],
        skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0,
      },
    },
  });
  const units = canonical.liveLog?.me.buildRowUnits ?? [];
  assert(!units.some((unit) => unit.source === 'local_draft'), 'local unit survived canonical replacement');
  assert(units.some((unit) => unit.source === 'canonical_preview'), 'canonical unit absent');
  assert(!units.some((unit) => unit.source === 'public'), 'public rows were concatenated with a complete ledger');
  assert(!units.some((unit) => unit.source === 'requester_capture'), 'requester rows were concatenated with a complete ledger');
  const card = mapBattleLogThisTurn(canonical);
  assert(card !== null);
  assert(
    JSON.stringify(lineText(card.me.buildLines)) ===
      JSON.stringify(['EVO', 'Intervention: 1 x FIG', 'FIG (DEF)']),
    'display mapping did not preserve the composed unit order',
  );
  assert(canonical.me.damage.current.state === 'value');
  assert(canonical.me.damage.last.state === 'zero');
  assert(canonical.opponent.damage.current.state === 'concealed');
});

Deno.test('local chronology places a captured row between clicks and a later captured group takes its slot', () => {
  const draft = {
    builds: [{ shipDefId: 'DEF', count: 1 }, { shipDefId: 'FIG', count: 1 }],
    buildGroupOrder: [
      { shipDefId: 'DEF', afterCaptureSequence: 2 },
      { shipDefId: 'FIG', afterCaptureSequence: 1 },
    ],
  };
  const local = base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    localDraft: draft,
    activePreviewCandidate: previewCandidate({ draft }),
    requesterThisTurn: {
      captureSequence: 2,
      ownBuildCaptureIdentity: 'capture-2',
      capturedBuildLines: [],
      capturedBuildRows: [{
        line: 'KNO rerolled 2 -> 5', groupKey: 'action:1',
        appearanceAnchor: 2, appearanceRank: 0, kind: 'action',
      }],
      committedProjection: null,
    },
    publicThisTurn: {
      identity: { gameId: 'game-1', turnNumber: 4 },
      battleLog: {
        turnNumber: 4, diceValue: 3,
        buildLinesByPlayerId: { p1: [], p2: [] }, battleLinesByPlayerId: {},
        concealedBuildPlayerIds: ['p2'],
      },
      estimatesByPlayerId: {},
    },
  });
  const localCard = mapBattleLogThisTurn(local);
  assert(localCard !== null);
  assert(
    JSON.stringify(lineText(localCard.me.buildLines)) ===
      JSON.stringify(['DEF', 'KNO rerolled 2 -> 5', 'FIG']),
    'captured row did not remain between its surrounding local clicks',
  );

  const settledCandidate = schedulerCandidate(previewCandidate({
    draft,
    ownBuildCaptureIdentity: 'capture-3',
  }));
  const settled = base({
    kind: 'estimated',
    candidate: settledCandidate,
    estimate: {
      status: 'estimated', requestToken: settledCandidate.requestToken,
      identity: {
        gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing',
        sourceContextKey: 'route', draftKey: 'ordered', ownBuildCaptureIdentity: 'capture-3',
      },
      playerId: 'p1', damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] },
      build: {
        lines: ['1 x DEF', '1 x FIG (DRE)', 'KNO rerolled 2 -> 5', '1 x FIG'],
        skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0,
      },
    },
  }, 'build.drawing', 'player', false, {
    localDraft: draft,
    activePreviewCandidate: previewCandidate({ draft, ownBuildCaptureIdentity: 'capture-3' }),
  });
  const settledCard = mapBattleLogThisTurn(settled);
  assert(settledCard !== null);
  assert(
    JSON.stringify(lineText(settledCard.me.buildLines)) ===
      JSON.stringify(['DEF', 'FIG (DRE)', 'KNO rerolled 2 -> 5', 'FIG']),
    'complete preview reordered existing groups when production was captured',
  );
});

Deno.test('ZEN keeps its produced ANT row through local, preview, frozen, Reveal, and archive handoffs', () => {
  const draft = {
    builds: [
      { shipDefId: 'ANT', count: 1 },
      { shipDefId: 'ZEN', count: 1 },
    ],
    buildGroupOrder: [{ shipDefId: 'ZEN', afterCaptureSequence: 0 }],
  };
  const candidateInput = previewCandidate({
    draft,
    ownBuildCaptureIdentity: 'capture-zen',
  });
  const candidate = schedulerCandidate(candidateInput);
  const publicDrawing = {
    identity: { gameId: 'game-1', turnNumber: 4 },
    battleLog: {
      turnNumber: 4, diceValue: 3,
      buildLinesByPlayerId: { p1: [], p2: [] }, battleLinesByPlayerId: {},
      concealedBuildPlayerIds: ['p2'],
    },
    estimatesByPlayerId: {},
  };
  const requesterDrawing = {
    captureSequence: 0,
    ownBuildCaptureIdentity: 'capture-zen',
    capturedBuildLines: [], capturedBuildRows: [], committedProjection: null,
  };
  const drawingOverrides = {
    localDraft: draft,
    activePreviewCandidate: candidateInput,
    publicThisTurn: publicDrawing,
    requesterThisTurn: requesterDrawing,
  };
  const ownLines = (presentation: ReturnType<typeof buildThisTurnPresentation>) => {
    const card = mapBattleLogThisTurn(presentation);
    assert(card !== null);
    return lineText(card.me.buildLines);
  };
  const expected = ['ANT (ZEN)', 'ZEN'];

  assert(JSON.stringify(ownLines(base({ kind: 'idle' }, 'build.drawing', 'player', false, drawingOverrides))) === JSON.stringify(expected));
  assert(JSON.stringify(ownLines(base({ kind: 'pending', candidate }, 'build.drawing', 'player', false, drawingOverrides))) === JSON.stringify(expected));

  const settledPreview: CurrentTurnPreviewState = {
    kind: 'estimated',
    candidate,
    estimate: {
      status: 'estimated', requestToken: candidate.requestToken,
      identity: {
        gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing',
        sourceContextKey: 'route', draftKey: 'zen',
        ownBuildCaptureIdentity: 'capture-zen',
      },
      playerId: 'p1', damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] },
      build: {
        lines: ['1 x ANT (ZEN)', '1 x ZEN'],
        skipped: [], remainingOrdinaryLines: 0, remainingJoiningLines: 0,
      },
    },
  };
  assert(JSON.stringify(ownLines(base(settledPreview, 'build.drawing', 'player', false, drawingOverrides))) === JSON.stringify(expected));
  assert(JSON.stringify(ownLines(base({ kind: 'pending', candidate }, 'build.drawing', 'player', false, {
    ...drawingOverrides,
    acceptedDraft: draft,
  }))) === JSON.stringify(expected));
  assert(JSON.stringify(ownLines(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    ...drawingOverrides,
    requesterThisTurn: {
      ...requesterDrawing,
      committedProjection: {
        status: 'estimated',
        build: { lines: ['1 x ANT (ZEN)', '1 x ZEN'] },
      },
    },
  }))) === JSON.stringify(expected));

  const publicReveal = {
    ...publicDrawing,
    battleLog: {
      ...publicDrawing.battleLog,
      buildLinesByPlayerId: { p1: ['1 x ANT (ZEN)', '1 x ZEN'], p2: [] },
      concealedBuildPlayerIds: [],
    },
  };
  assert(JSON.stringify(ownLines(base({ kind: 'idle' }, 'build.reveal', 'player', false, {
    publicThisTurn: publicReveal,
  }))) === JSON.stringify(expected));

  const history: any = historyFor(4);
  history.turns[0].buildLinesByPlayerId.p1 = ['1 x ANT (ZEN)', '1 x ZEN'];
  const archived = mapBattleLogTurns({
    battleLogHistory: history, thisTurn: null,
    localPlayerId: 'p1', localPlayerName: 'One',
    opponentPlayerId: 'p2', opponentName: 'Two',
  });
  assert(JSON.stringify(lineText(archived.battleLogTurns[0].me.buildLines)) === JSON.stringify(expected));
});

Deno.test('successful EVO conversion survives pending, preview, submission, Reveal, hold, and archive', () => {
  const initialDraft = {
    builds: [],
    evolverChoices: [{ sourceKey: 'evo-1', choiceId: 'oxite' as const }],
  };
  const nextDraft = {
    builds: [{ shipDefId: 'FIG', count: 1 }],
    buildGroupOrder: [{ shipDefId: 'FIG', afterCaptureSequence: 0 }],
    evolverChoices: [{ sourceKey: 'evo-1', choiceId: 'oxite' as const }],
  };
  const conversions = [{ sourceKey: 'evo-1', shipDefId: 'OXI' as const }];
  const publicDrawing = {
    identity: { gameId: 'game-1', turnNumber: 4 },
    battleLog: {
      turnNumber: 4, diceValue: 3,
      buildLinesByPlayerId: { p1: [], p2: [] }, battleLinesByPlayerId: {},
      concealedBuildPlayerIds: ['p2'],
    },
    estimatesByPlayerId: {},
  };
  const requesterDrawing = {
    captureSequence: 0,
    ownBuildCaptureIdentity: 'capture-evo',
    capturedBuildLines: [], capturedBuildRows: [], committedProjection: null,
  };
  const ownLines = (presentation: ReturnType<typeof buildThisTurnPresentation>) => {
    const card = mapBattleLogThisTurn(presentation);
    assert(card !== null);
    return lineText(card.me.buildLines);
  };

  const initialInput = previewCandidate({
    draft: initialDraft,
    ownBuildCaptureIdentity: 'capture-evo',
  });
  const initialCandidate = schedulerCandidate(initialInput);
  const initialOverrides = {
    localDraft: initialDraft,
    localEvolverConversions: conversions,
    activePreviewCandidate: initialInput,
    publicThisTurn: publicDrawing,
    requesterThisTurn: requesterDrawing,
  };
  assert(JSON.stringify(ownLines(base({ kind: 'pending', candidate: initialCandidate }, 'build.drawing', 'player', false, initialOverrides))) === JSON.stringify(['OXI (EVO)']));

  const initialSettled: CurrentTurnPreviewState = {
    kind: 'estimated', candidate: initialCandidate,
    estimate: {
      status: 'estimated', requestToken: initialCandidate.requestToken,
      identity: {
        gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing',
        sourceContextKey: 'route',
        draftKey: 'evo-initial',
        ownBuildCaptureIdentity: 'capture-evo',
      },
      playerId: 'p1', damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] },
      build: {
        lines: ['1 x OXI (EVO)'], skipped: [],
        remainingOrdinaryLines: 0, remainingJoiningLines: 0,
      },
    },
  };
  assert(JSON.stringify(ownLines(base(initialSettled, 'build.drawing', 'player', false, initialOverrides))) === JSON.stringify(['OXI (EVO)']));

  const nextInput = previewCandidate({
    draft: nextDraft,
    ownBuildCaptureIdentity: 'capture-evo',
  });
  const nextCandidate = schedulerCandidate(nextInput, 2);
  const nextOverrides = {
    ...initialOverrides,
    localDraft: nextDraft,
    activePreviewCandidate: nextInput,
  };
  const expected = ['OXI (EVO)', 'FIG'];
  assert(JSON.stringify(ownLines(base({ kind: 'pending', candidate: nextCandidate }, 'build.drawing', 'player', false, nextOverrides))) === JSON.stringify(expected));

  const nextSettled: CurrentTurnPreviewState = {
    kind: 'estimated', candidate: nextCandidate,
    estimate: {
      ...initialSettled.estimate,
      requestToken: nextCandidate.requestToken,
      identity: {
        gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing',
        sourceContextKey: 'route',
        draftKey: 'evo-next',
        ownBuildCaptureIdentity: 'capture-evo',
      },
      build: {
        lines: ['1 x OXI (EVO)', '1 x FIG'], skipped: [],
        remainingOrdinaryLines: 0, remainingJoiningLines: 0,
      },
    },
  };
  assert(JSON.stringify(ownLines(base(nextSettled, 'build.drawing', 'player', false, nextOverrides))) === JSON.stringify(expected));
  assert(JSON.stringify(ownLines(base({ kind: 'pending', candidate: nextCandidate }, 'build.drawing', 'player', false, {
    ...nextOverrides,
    acceptedDraft: nextDraft,
  }))) === JSON.stringify(expected));
  assert(JSON.stringify(ownLines(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    ...nextOverrides,
    requesterThisTurn: {
      ...requesterDrawing,
      committedProjection: {
        status: 'estimated',
        build: { lines: ['1 x OXI (EVO)', '1 x FIG'] },
      },
    },
  }))) === JSON.stringify(expected));

  const publicReveal = {
    ...publicDrawing,
    battleLog: {
      ...publicDrawing.battleLog,
      buildLinesByPlayerId: { p1: ['1 x OXI (EVO)', '1 x FIG'], p2: [] },
      concealedBuildPlayerIds: [],
    },
  };
  const reveal = base({ kind: 'idle' }, 'build.reveal', 'player', false, {
    publicThisTurn: publicReveal,
  });
  assert(JSON.stringify(ownLines(reveal)) === JSON.stringify(expected));

  const snapshot = buildResolvedThisTurnSnapshot({
    gameId: 'game-1', resolvedTurnNumber: 4, isTerminalTurn: false,
    mePlayerId: 'p1', opponentPlayerId: 'p2', previous: reveal,
    actualMe: { damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] } },
    actualOpponent: { damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] } },
  });
  const held = base({ kind: 'idle' }, 'battle.end_of_turn_resolution', 'player', false, {
    resolutionSnapshot: snapshot,
    archiveRecovery: { turnNumber: 4, state: 'pending' },
  });
  assert(JSON.stringify(ownLines(held)) === JSON.stringify(expected));

  const history: any = historyFor(4);
  history.turns[0].buildLinesByPlayerId.p1 = ['1 x OXI (EVO)', '1 x FIG'];
  const archived = mapBattleLogTurns({
    battleLogHistory: history, thisTurn: null,
    localPlayerId: 'p1', localPlayerName: 'One',
    opponentPlayerId: 'p2', opponentName: 'Two',
  });
  assert(JSON.stringify(lineText(archived.battleLogTurns[0].me.buildLines)) === JSON.stringify(expected));
});

Deno.test('EVO local groups update counts and clear changed or invalid conversions', () => {
  const draft = {
    builds: [],
    evolverChoices: [
      { sourceKey: 'evo-1', choiceId: 'oxite' as const },
      { sourceKey: 'evo-2', choiceId: 'oxite' as const },
      { sourceKey: 'evo-3', choiceId: 'asterite' as const },
    ],
  };
  const overrides = {
    localDraft: draft,
    activePreviewCandidate: previewCandidate({ draft }),
    publicThisTurn: {
      identity: { gameId: 'game-1', turnNumber: 4 },
      battleLog: {
        turnNumber: 4, diceValue: 3,
        buildLinesByPlayerId: { p1: [], p2: [] }, battleLinesByPlayerId: {},
        concealedBuildPlayerIds: ['p2'],
      },
      estimatesByPlayerId: {},
    },
    requesterThisTurn: {
      captureSequence: 0, ownBuildCaptureIdentity: 'capture-evo',
      capturedBuildLines: [], capturedBuildRows: [], committedProjection: null,
    },
  };
  const read = (localEvolverConversions: Array<{ sourceKey: string; shipDefId: 'OXI' | 'AST' }>) => {
    const card = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
      ...overrides,
      localEvolverConversions,
    }));
    assert(card !== null);
    return lineText(card.me.buildLines);
  };

  assert(JSON.stringify(read([
    { sourceKey: 'evo-1', shipDefId: 'OXI' },
    { sourceKey: 'evo-2', shipDefId: 'OXI' },
    { sourceKey: 'evo-3', shipDefId: 'AST' },
  ])) === JSON.stringify(['AST (EVO)', '2 x OXI (2 EVO)']));
  assert(JSON.stringify(read([
    { sourceKey: 'evo-1', shipDefId: 'OXI' },
    { sourceKey: 'evo-3', shipDefId: 'AST' },
  ])) === JSON.stringify(['AST (EVO)', 'OXI (EVO)']));
  assert(JSON.stringify(read([])) === JSON.stringify([]));

  const selectedDraft = {
    builds: [],
    evolverChoices: [{ sourceKey: 'evo-1', choiceId: 'oxite' as const }],
  };
  const selectedInput = previewCandidate({ draft: selectedDraft });
  const selectedCandidate = schedulerCandidate(selectedInput);
  const selectedPreview: CurrentTurnPreviewState = {
    kind: 'estimated', candidate: selectedCandidate,
    estimate: {
      status: 'estimated', requestToken: selectedCandidate.requestToken,
      identity: {
        gameId: 'game-1', turnNumber: 4, phaseKey: 'build.drawing',
        sourceContextKey: 'route', draftKey: 'selected',
      },
      playerId: 'p1', damage: { total: 0, rows: [] }, healing: { total: 0, rows: [] },
      build: {
        lines: ['1 x OXI (EVO)'], skipped: [],
        remainingOrdinaryLines: 0, remainingJoiningLines: 0,
      },
    },
  };
  const holdDraft = {
    builds: [],
    evolverChoices: [{ sourceKey: 'evo-1', choiceId: 'hold' as const }],
  };
  const holdCard = mapBattleLogThisTurn(base(selectedPreview, 'build.drawing', 'player', false, {
    ...overrides,
    localDraft: holdDraft,
    activePreviewCandidate: previewCandidate({ draft: holdDraft }),
    localEvolverConversions: [],
  }));
  assert(holdCard !== null);
  assert(JSON.stringify(lineText(holdCard.me.buildLines)) === JSON.stringify([]));

  const lostXenCard = mapBattleLogThisTurn(base(selectedPreview, 'build.drawing', 'player', false, {
    ...overrides,
    localDraft: selectedDraft,
    activePreviewCandidate: previewCandidate({
      draft: selectedDraft,
      safeContextFingerprint: 'after-xen-loss',
    }),
    localEvolverConversions: [],
  }));
  assert(lostXenCard !== null);
  assert(JSON.stringify(lineText(lostXenCard.me.buildLines)) === JSON.stringify([]));
});

Deno.test('ZEN provisional rows group multiples and keep separately paid ANT manual', () => {
  const cases = [
    {
      draft: {
        builds: [{ shipDefId: 'ANT', count: 2 }, { shipDefId: 'ZEN', count: 2 }],
        buildGroupOrder: [{ shipDefId: 'ZEN', afterCaptureSequence: 0 }],
      },
      expected: ['2 x ANT (2 ZEN)', '2 x ZEN'],
    },
    {
      draft: {
        builds: [{ shipDefId: 'ANT', count: 2 }, { shipDefId: 'ZEN', count: 1 }],
        buildGroupOrder: [
          { shipDefId: 'ANT', afterCaptureSequence: 0 },
          { shipDefId: 'ZEN', afterCaptureSequence: 0 },
        ],
      },
      expected: ['ANT', 'ANT (ZEN)', 'ZEN'],
    },
  ];
  for (const testCase of cases) {
    const presentation = base({ kind: 'idle' }, 'build.drawing', 'player', false, {
      localDraft: testCase.draft,
      activePreviewCandidate: previewCandidate({ draft: testCase.draft }),
      publicThisTurn: {
        identity: { gameId: 'game-1', turnNumber: 4 },
        battleLog: {
          turnNumber: 4, diceValue: 3,
          buildLinesByPlayerId: { p1: [], p2: [] }, battleLinesByPlayerId: {},
          concealedBuildPlayerIds: ['p2'],
        },
        estimatesByPlayerId: {},
      },
      requesterThisTurn: {
        captureSequence: 0, ownBuildCaptureIdentity: 'capture-zen',
        capturedBuildLines: [], capturedBuildRows: [], committedProjection: null,
      },
    });
    const card = mapBattleLogThisTurn(presentation);
    assert(card !== null);
    assert(JSON.stringify(lineText(card.me.buildLines)) === JSON.stringify(testCase.expected));
  }
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

Deno.test('own empty build stays blank until accepted and survives refresh as Saved', () => {
  const publicThisTurn = {
    identity: { gameId: 'game-1', turnNumber: 4 },
    battleLog: {
      turnNumber: 4, diceValue: 3,
      buildLinesByPlayerId: { p1: ['CHR rolled 3 3'], p2: ['KNO rerolled 2 -> 3'] },
      battleLinesByPlayerId: {}, concealedBuildPlayerIds: ['p2'],
    },
    estimatesByPlayerId: {},
  };
  const requesterThisTurn = {
    captureSequence: 1,
    ownBuildCaptureIdentity: 'capture-empty',
    capturedBuildLines: [],
    capturedBuildRows: [{
      line: 'CHR rolled 3 3', groupKey: 'action:0',
      appearanceAnchor: 1, appearanceRank: 0, kind: 'action',
    }],
    committedProjection: null,
  };
  const blank = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    publicThisTurn, requesterThisTurn, localDraft: { builds: [] },
  }));
  assert(blank !== null);
  assert(JSON.stringify(lineText(blank.me.buildLines)) === JSON.stringify(['CHR rolled 3 3']));
  assert(!lineText(blank.me.buildLines).includes('???'));

  const accepted = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    publicThisTurn, requesterThisTurn, localDraft: { builds: [] }, acceptedDraft: { builds: [] },
  }));
  assert(accepted !== null);
  assert(JSON.stringify(lineText(accepted.me.buildLines)) === JSON.stringify(['Saved', 'CHR rolled 3 3']));
  assert(accepted.me.buildLines[0]?.variant === 'saved');

  const refreshed = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    publicThisTurn,
    localDraft: { builds: [] },
    requesterThisTurn: {
      ...requesterThisTurn,
      committedProjection: {
        status: 'estimated',
        build: { lines: ['CHR rolled 3 3'] },
      },
    },
  }));
  assert(refreshed !== null);
  assert(JSON.stringify(lineText(refreshed.me.buildLines)) === JSON.stringify(['Saved', 'CHR rolled 3 3']));
});

Deno.test('concealment is orientation-safe for players and hides both spectator sides', () => {
  const publicThisTurn = {
    identity: { gameId: 'game-1', turnNumber: 4 },
    battleLog: {
      turnNumber: 4, diceValue: 3,
      buildLinesByPlayerId: { p1: [], p2: [] }, battleLinesByPlayerId: {},
      concealedBuildPlayerIds: ['p1', 'p2'],
    },
    estimatesByPlayerId: {},
  };
  const p2 = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.drawing', 'player', false, {
    mePlayerId: 'p2', opponentPlayerId: 'p1', publicThisTurn,
    localDraft: { builds: [] }, requesterThisTurn: null,
  }));
  assert(p2 !== null);
  assert(!lineText(p2.me.buildLines).includes('???'), 'own p2 side was concealed');
  assert(lineText(p2.opponent.buildLines).includes('???'), 'opponent p1 side was exposed');

  const spectator = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.drawing', 'spectator', false, {
    publicThisTurn, requesterThisTurn: null,
  }));
  assert(spectator !== null);
  assert(lineText(spectator.me.buildLines).includes('???'));
  assert(lineText(spectator.opponent.buildLines).includes('???'));
});

Deno.test('Reveal and history distinguish action-only, produced-only, empty, and unknown legacy rows', () => {
  const reveal = mapBattleLogThisTurn(base({ kind: 'idle' }, 'build.reveal', 'player', false, {
    publicThisTurn: {
      identity: { gameId: 'game-1', turnNumber: 4 },
      battleLog: {
        turnNumber: 4, diceValue: 3,
        buildLinesByPlayerId: {
          p1: ['1 x FIG (DRE)'],
          p2: ['CHR rolled 3 3'],
        },
        battleLinesByPlayerId: {}, concealedBuildPlayerIds: [],
      },
      estimatesByPlayerId: {},
    },
  }));
  assert(reveal !== null);
  assert(JSON.stringify(lineText(reveal.me.buildLines)) === JSON.stringify(['FIG (DRE)']));
  assert(JSON.stringify(lineText(reveal.opponent.buildLines)) === JSON.stringify(['Saved', 'CHR rolled 3 3']));

  const history: any = {
    gameId: 'game-1', revision: 1, completedTurnCount: 1,
    turns: [{
      turnNumber: 4, diceValue: 3,
      players: [
        { playerId: 'p1', name: 'One', healthEnd: 25, healthDelta: 0, fleetValueEnd: 0 },
        { playerId: 'p2', name: 'Two', healthEnd: 25, healthDelta: 0, fleetValueEnd: 0 },
      ],
      buildLinesByPlayerId: { p1: [], p2: ['CHR rolled 3 3'] },
      battleLinesByPlayerId: { p1: [], p2: [] },
    }],
  };
  const mapped = mapBattleLogTurns({
    battleLogHistory: history,
    thisTurn: null,
    localPlayerId: 'p1', localPlayerName: 'One',
    opponentPlayerId: 'p2', opponentName: 'Two',
  });
  assert(JSON.stringify(lineText(mapped.battleLogTurns[0].me.buildLines)) === JSON.stringify(['Saved']));
  assert(JSON.stringify(lineText(mapped.battleLogTurns[0].opponent.buildLines)) === JSON.stringify(['Saved', 'CHR rolled 3 3']));

  history.turns[0].buildLinesByPlayerId.p1 = ['legacy nonempty build'];
  const legacy = mapBattleLogTurns({
    battleLogHistory: history,
    thisTurn: null,
    localPlayerId: 'p1', localPlayerName: 'One',
    opponentPlayerId: 'p2', opponentName: 'Two',
  });
  assert(JSON.stringify(lineText(legacy.battleLogTurns[0].me.buildLines)) === JSON.stringify(['legacy nonempty build']));
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
  assert(!card.showBattleSection && card.showBuildSection);
  assert(JSON.stringify(lineText(card.me.buildLines)) === JSON.stringify(['Saved']));
  assert(JSON.stringify(lineText(card.opponent.buildLines)) === JSON.stringify(['Saved']));
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

Deno.test('resolved terminal snapshot marks authoritative metrics as final actuals', () => {
  const previous = base({ kind: 'idle' });
  const snapshot = buildResolvedThisTurnSnapshot({
    gameId: 'game-1', resolvedTurnNumber: 4, isTerminalTurn: true,
    mePlayerId: 'p1', opponentPlayerId: 'p2', previous,
    actualMe: {
      damage: { total: 7, rows: [] }, healing: { total: 0, rows: [] },
    },
    actualOpponent: {
      damage: { total: 3, rows: [] }, healing: { total: 1, rows: [] },
    },
  });
  assert(
    snapshot.me.damage.current.state === 'value' &&
    snapshot.me.damage.current.source === 'final_actual',
  );
  assert(
    snapshot.me.healing.current.state === 'zero' &&
    snapshot.me.healing.current.source === 'final_actual',
  );
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

Deno.test('Reveal-to-archive handoff preserves row order for both orientations and spectators', () => {
  const buildLinesByPlayerId = {
    p1: ['1 x FIG (DRE)', '2 x DEF', 'CHR rolled 3 3'],
    p2: ['1 x ANT (ZEN)', '1 x FIG'],
  };
  const publicThisTurn = {
    identity: { gameId: 'game-1', turnNumber: 4 },
    battleLog: {
      turnNumber: 4, diceValue: 3, buildLinesByPlayerId,
      battleLinesByPlayerId: { p1: [], p2: [] }, concealedBuildPlayerIds: [],
    },
    estimatesByPlayerId: {},
  };
  const history = {
    gameId: 'game-1', revision: 1, completedTurnCount: 1,
    turns: [{
      turnNumber: 4, diceValue: 3,
      players: [
        { playerId: 'p1', name: 'One', healthEnd: 25, healthDelta: 0, fleetValueEnd: 0 },
        { playerId: 'p2', name: 'Two', healthEnd: 25, healthDelta: 0, fleetValueEnd: 0 },
      ],
      buildLinesByPlayerId,
      battleLinesByPlayerId: { p1: [], p2: [] },
    }],
  };
  for (const orientation of [
    { viewerRole: 'player' as const, mePlayerId: 'p1', opponentPlayerId: 'p2' },
    { viewerRole: 'player' as const, mePlayerId: 'p2', opponentPlayerId: 'p1' },
    { viewerRole: 'spectator' as const, mePlayerId: 'p1', opponentPlayerId: 'p2' },
  ]) {
    const livePresentation = base({ kind: 'idle' }, 'build.reveal', orientation.viewerRole, false, {
      ...orientation, publicThisTurn, requesterThisTurn: null,
    });
    const live = mapBattleLogThisTurn(livePresentation);
    assert(live !== null);
    const archived = mapBattleLogTurns({
      battleLogHistory: history,
      thisTurn: null,
      localPlayerId: orientation.mePlayerId,
      localPlayerName: orientation.mePlayerId === 'p1' ? 'One' : 'Two',
      opponentPlayerId: orientation.opponentPlayerId,
      opponentName: orientation.opponentPlayerId === 'p1' ? 'One' : 'Two',
    }).battleLogTurns[0];
    assert(JSON.stringify(lineText(live.me.buildLines)) === JSON.stringify(lineText(archived.me.buildLines)));
    assert(JSON.stringify(lineText(live.opponent.buildLines)) === JSON.stringify(lineText(archived.opponent.buildLines)));
  }
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
