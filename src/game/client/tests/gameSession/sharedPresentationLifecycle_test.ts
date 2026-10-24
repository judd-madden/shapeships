import { readFile } from 'node:fs/promises';
import * as React from 'react';
import type { Root } from 'react-dom/client';
import ts from 'typescript';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { useCurrentTurnPreview } from '../../gameSession/clienteffects/useCurrentTurnPreview';
import {
  createTurnStartStatPresentationState, syncTurnStartStatPresentation,
  type TurnStartStatPresentationState,
} from '../../gameSession/clienteffects/turnStartPresentationGates';
import type { CurrentTurnPreviewCandidateInput, CurrentTurnPreviewState, CurrentTurnPreviewTransport } from '../../gameSession/currentTurnPreview';
import type {
  ResolvedHealthCompletionIdentity, ResolvedHealthPresentation, ResolvedHealthSessionPresentation,
  ResolvedHealthSnapshot, ThisTurnPresentationVm,
} from '../../gameSession/types';
import { useSessionHealthBarPresentation } from '../../../display/healthBars/useSessionHealthBarPresentation';
import type { HealthBarAnimationScheduler } from '../../../display/healthBars/healthBarAnimationController';

// Actual ReactDOM scheduling and external-store subscriptions; no mocked hooks.
// This host supports null-rendering hook probes only, not layout or browser APIs.
let createRoot: typeof import('react-dom/client').createRoot;
let flushSync: typeof import('react-dom').flushSync;
let hostDocument: Record<string, any>;
let reducedMotion = true;
const roots: Root[] = [];
let consoleError: ReturnType<typeof vi.spyOn>;

interface StatsInput {
  gameId: string;
  orientationKey: string;
  turnNumber: number;
  presentation: ThisTurnPresentationVm;
  settledTurnNumber: number | null;
  firstTurnRollPresentationActive: boolean;
  resolvedPresentationTurnNumber?: number | null;
}
interface StatsScope {
  useLayoutEffect: typeof React.useLayoutEffect;
  setTurnStartStatPresentationState: React.Dispatch<React.SetStateAction<TurnStartStatPresentationState>>;
  syncTurnStartStatPresentation: typeof syncTurnStartStatPresentation;
  effectiveGameId: string;
  thisTurnStatOrientationKey: string;
  turnNumber: number;
  thisTurnPresentation: ThisTurnPresentationVm;
  presentedTurnDiceSettledTurnNumber: number | null;
  firstTurnRollStatPresentationActive: boolean;
  thisTurnResolutionSnapshot: { resolvedTurnNumber: number } | null;
  turnStartStatPresentationState: TurnStartStatPresentationState;
}
const statsBindings: Array<keyof StatsScope> = [
  'useLayoutEffect', 'setTurnStartStatPresentationState', 'syncTurnStartStatPresentation',
  'effectiveGameId', 'thisTurnStatOrientationKey', 'turnNumber', 'thisTurnPresentation',
  'presentedTurnDiceSettledTurnNumber', 'firstTurnRollStatPresentationActive',
  'thisTurnResolutionSnapshot', 'turnStartStatPresentationState',
];
let statsEffect: (scope: StatsScope) => void;
let unguardedStatsEffect: (scope: StatsScope) => void;

// Execute the production call site, including its dependencies and dispatch guard.
// Removing only the pre-dispatch return supplies the known failing scheduling control.
function extractStatsEffect(source: string, removeGuard = false) {
  const file = ts.createSourceFile('useGameSession.ts', source, ts.ScriptTarget.Latest, true);
  const matches: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'useLayoutEffect' &&
      node.arguments[0]?.getText(file).includes('setTurnStartStatPresentationState')) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (matches.length !== 1) throw new Error('Expected one production stats synchronization effect');
  let code = matches[0].getText(file);
  if (removeGuard) {
    const effect = ts.createSourceFile('effect.ts', code, ts.ScriptTarget.Latest, true);
    const guards: ts.IfStatement[] = [];
    const findGuard = (node: ts.Node) => {
      if (ts.isIfStatement(node) && node.expression.getText(effect).includes('turnStartStatPresentationState') &&
        ts.isReturnStatement(node.thenStatement)) guards.push(node);
      ts.forEachChild(node, findGuard);
    };
    findGuard(effect);
    for (const guard of guards.reverse()) code = code.slice(0, guard.getStart(effect)) + code.slice(guard.end);
  }
  const javascript = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const evaluate = new Function(...statsBindings, javascript);
  return (scope: StatsScope) => evaluate(...statsBindings.map((name) => scope[name]));
}

beforeAll(async () => {
  hostDocument = { nodeType: 9, addEventListener() {}, removeEventListener() {} };
  hostDocument.createElement = (name: string) => ({
    nodeType: 1, nodeName: name.toUpperCase(), tagName: name.toUpperCase(), ownerDocument: hostDocument,
    style: {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  });
  hostDocument.body = hostDocument.createElement('body');
  hostDocument.documentElement = hostDocument.createElement('html');
  hostDocument.activeElement = hostDocument.body;
  vi.stubGlobal('document', hostDocument);
  vi.stubGlobal('window', {
    document: hostDocument, HTMLIFrameElement: class {},
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }),
  });
  vi.stubGlobal('navigator', { userAgent: 'node' });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // Import after installing the host, so ReactDOM sees a consistent environment.
  ({ createRoot } = await import('react-dom/client'));
  ({ flushSync } = await import('react-dom'));
  const source = await readFile(new URL('../../useGameSession.ts', import.meta.url), 'utf8');
  statsEffect = extractStatsEffect(source);
  unguardedStatsEffect = extractStatsEffect(source, true);
});
beforeEach(() => {
  reducedMotion = true;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  try {
    await React.act(async () => { roots.splice(0).forEach((root) => root.unmount()); });
  } finally {
    consoleError.mockRestore();
  }
});
afterAll(() => { vi.unstubAllGlobals(); });

class ProbeBoundary extends React.Component<{
  children: React.ReactNode; onError: (error: Error) => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
function mountProbe(Probe: () => null, errors: Error[], strict = false) {
  const root = createRoot(hostDocument.createElement('div') as HTMLElement);
  roots.push(root);
  return () => React.act(async () => {
    const content = React.createElement(Probe);
    root.render(React.createElement(ProbeBoundary, { onError: (error: Error) => errors.push(error),
      children: strict ? React.createElement(React.StrictMode, null, content) : content }));
  });
}
function assertHealthy(errors: Error[]) {
  expect(errors).toEqual([]);
  expect(consoleError).not.toHaveBeenCalled();
}
function statInput(turnNumber = 18, total = 3, phaseKey = 'build.drawing'): StatsInput {
  const metric = (turn: number) => ({ state: 'value' as const, turnNumber: turn,
    source: 'estimated' as const, total, rows: [] });
  const player = (playerId: string) => ({ playerId, damage: { current: metric(turnNumber), last: metric(turnNumber - 1) },
    healing: { current: metric(turnNumber), last: metric(turnNumber - 1) } });
  return { gameId: 'g', orientationKey: 'player:p1:p2', turnNumber, settledTurnNumber: turnNumber,
    firstTurnRollPresentationActive: false,
    presentation: { turnNumber, phaseKey, liveLog: null, me: player('p1'), opponent: player('p2'),
      archiveHandoff: null, mobile: { pairKey: `g::${turnNumber}`, opponentDetail: 'this_turn' } } };
}
function statsProbe(initial: StatsInput, unguarded = false) {
  let input = initial;
  const trace = { renders: 0, commits: 0, dispatches: 0, changes: 0, errors: [] as Error[],
    state: null as TurnStartStatPresentationState | null, overlap: () => {} };
  function Probe() {
    if (++trace.renders > 200) throw new Error('Stats probe did not settle');
    const [, setDraft] = React.useState({ count: 0 });
    const [, setHover] = React.useState<string | null>(null);
    const [state, setState] = React.useState(() => createTurnStartStatPresentationState(input));
    trace.state = state;
    (unguarded ? unguardedStatsEffect : statsEffect)({
      useLayoutEffect: React.useLayoutEffect,
      setTurnStartStatPresentationState: (action) => { trace.dispatches += 1; setState(action); },
      syncTurnStartStatPresentation: (current, args) => {
        const next = syncTurnStartStatPresentation(current, args);
        if (next !== current) trace.changes += 1;
        return next;
      },
      effectiveGameId: input.gameId, thisTurnStatOrientationKey: input.orientationKey,
      turnNumber: input.turnNumber, thisTurnPresentation: structuredClone(input.presentation),
      presentedTurnDiceSettledTurnNumber: input.settledTurnNumber,
      firstTurnRollStatPresentationActive: input.firstTurnRollPresentationActive,
      thisTurnResolutionSnapshot: input.resolvedPresentationTurnNumber == null
        ? null : { resolvedTurnNumber: input.resolvedPresentationTurnNumber },
      turnStartStatPresentationState: state,
    });
    React.useLayoutEffect(() => { trace.commits += 1; });
    trace.overlap = () => {
      // Controlled lane overlap, not historical click timing or authoritative game state.
      React.startTransition(() => { setDraft((current) => current); setHover('pending'); });
      flushSync(() => setDraft((current) => ({ ...current, count: 1 })));
    };
    return null;
  }
  const render = mountProbe(Probe, trace.errors);
  return { trace, render, update: async (next: StatsInput) => { input = next; await render(); } };
}

it.each(['build.drawing', 'finished'])('settles equivalent stats during controlled overlap in %s without targeting', async (phase) => {
  const probe = statsProbe(statInput(19, 3, phase));
  await probe.render();
  await React.act(async () => { probe.trace.overlap(); });
  assertHealthy(probe.trace.errors);
  expect(probe.trace.dispatches).toBe(0);
  expect(probe.trace.changes).toBe(0);
  expect(probe.trace.commits).toBeLessThan(10);
});

it('reproduces update-depth failure when only the production stats pre-dispatch return is removed', async () => {
  const probe = statsProbe(statInput(19), true);
  await probe.render();
  await React.act(async () => { probe.trace.overlap(); });
  expect(probe.trace.errors.some((error) => error.message.includes('Maximum update depth exceeded'))).toBe(true);
  expect(probe.trace.changes).toBe(0);
  expect(probe.trace.commits).toBeGreaterThan(50);
  expect(consoleError).toHaveBeenCalled();
});

it('preserves the dice hold, releases changed stats, and presents terminal stats once', async () => {
  const initial = statInput();
  const probe = statsProbe(initial);
  await probe.render();
  const rollover = { ...statInput(19, 7), settledTurnNumber: 18 };
  await probe.update(rollover);
  expect(probe.trace.state?.presented).toEqual(initial.presentation);
  expect(probe.trace.state?.pendingTurnNumber).toBe(19);
  const dispatches = probe.trace.dispatches;
  for (let index = 0; index < 20; index += 1) await probe.update(structuredClone(rollover));
  expect(probe.trace.dispatches).toBe(dispatches);
  await probe.update({ ...rollover, settledTurnNumber: 19 });
  expect(probe.trace.state?.presented).toEqual(rollover.presentation);
  expect(probe.trace.state?.pendingTurnNumber).toBeNull();
  const terminal = { ...statInput(19, 11, 'finished'), resolvedPresentationTurnNumber: 19 };
  await probe.update(terminal);
  expect(probe.trace.state?.presented).toEqual(terminal.presentation);
  const terminalDispatches = probe.trace.dispatches;
  await probe.update(structuredClone(terminal));
  expect(probe.trace.dispatches).toBe(terminalDispatches);
  assertHealthy(probe.trace.errors);
});

it('keeps the first-turn neutral stats until dice settle', async () => {
  const input = { ...statInput(1, 9), settledTurnNumber: null, firstTurnRollPresentationActive: true };
  const probe = statsProbe(input);
  await probe.render();
  expect(probe.trace.state?.presented?.me.damage.current).toMatchObject({ total: 0, source: 'turn_start_baseline' });
  expect(probe.trace.dispatches).toBe(0);
  await probe.update({ ...input, settledTurnNumber: 1, firstTurnRollPresentationActive: false });
  expect(probe.trace.state?.presented).toEqual(input.presentation);
  assertHealthy(probe.trace.errors);
});

const chargeCandidate: CurrentTurnPreviewCandidateInput = {
  gameId: 'g', playerId: 'p1', turnNumber: 18, phaseKey: 'battle.charge_declaration', safeContextFingerprint: 'safe',
  declaration: { contractVersion: 1, declarationId: 'g:p1:18:preview', ordinaryChargeActions: [], solarCasts: [], autocastEnabled: false },
};
it.each([false, true])('settles fresh equivalent paused Charge candidates with no targets (Strict Mode %s)', async (strict) => {
  let reason: string | null = 'submission_pending';
  let candidate: CurrentTurnPreviewCandidateInput | null = chargeCandidate;
  let state: CurrentTurnPreviewState | undefined;
  let renders = 0;
  const errors: Error[] = [];
  const transport = vi.fn<CurrentTurnPreviewTransport>(async () => { throw new Error('paused preview launched'); });
  function Probe() {
    if (++renders > 80) throw new Error('Paused preview probe did not settle');
    state = useCurrentTurnPreview({ gameId: 'g', candidate: structuredClone(candidate), pausedReason: reason,
      recoveryKey: 0, transport });
    return null;
  }
  const render = mountProbe(Probe, errors, strict);
  await render();
  expect(state).toMatchObject({ kind: 'paused', reason });
  const paused = state;
  for (let index = 0; index < 10; index += 1) await render();
  expect(state).toBe(paused);
  reason = 'session_sync_pending';
  await render();
  expect(state).toMatchObject({ kind: 'paused', reason });
  // Rollover/finish makes the candidate ineligible, then releases the pause.
  candidate = null;
  reason = null;
  await render();
  expect(state).toEqual({ kind: 'idle' });
  expect(transport).not.toHaveBeenCalled();
  expect(renders).toBeLessThan(50);
  assertHealthy(errors);
});

class FrameClock implements HealthBarAnimationScheduler {
  time = 0;
  serial = 0;
  frames = new Map<number, () => void>();
  now = () => this.time;
  request = (callback: () => void) => { this.frames.set(++this.serial, callback); return this.serial; };
  cancel = (handle: number) => { this.frames.delete(handle); };
  advance(ms: number) {
    this.time += ms;
    const callbacks = [...this.frames.values()];
    this.frames.clear();
    callbacks.forEach((callback) => callback());
  }
}
function healthInput(turn: number, terminal = false) {
  const identity = { gameId: 'g', viewerId: 'p1', viewerRole: 'player' as const, leftPlayerId: 'p1', rightPlayerId: 'p2' };
  const outcome = { isTerminal: terminal, winnerPlayerId: terminal ? 'p1' : null, resultReason: terminal ? 'decisive' : null };
  const side = (playerId: string) => {
    const startHealth = turn === 17 ? 35 : turn === 18 ? 30 : 25;
    const finalHealth = terminal && playerId === 'p2' ? -5 : startHealth - 5;
    return { playerId, startHealth, damageTaken: startHealth - finalHealth, damageStageHealth: finalHealth,
      grossHealingReceived: 0, finalHealth, actualNetDelta: finalHealth - startHealth, maxHealth: 35 };
  };
  const snapshot: ResolvedHealthSnapshot = { identity, outcome, continuityKey: 'ctx', presentationKey: `g::health::${turn}`,
    resolvedTurnNumber: turn, source: 'poll', eligibility: 'live', left: side('p1'), right: side('p2') };
  const session: ResolvedHealthSessionPresentation = { identity, continuityKey: 'ctx', observedResolvedTurnNumber: turn,
    settled: { mode: 'settled', identity, outcome, left: { playerId: 'p1', health: snapshot.left.finalHealth, maxHealth: 35 },
      right: { playerId: 'p2', health: snapshot.right.finalHealth, maxHealth: 35 } } };
  return { presentation: { mode: 'live', snapshot } as ResolvedHealthPresentation | null, session };
}

it.each([false, true])('settles health capture, release and terminal completion with equivalent inputs (reduced motion %s)', async (reduced) => {
  reducedMotion = reduced;
  const clock = new FrameClock();
  let input = healthInput(17);
  let renders = 0;
  let receipt: ResolvedHealthCompletionIdentity | null = null;
  let view: ReturnType<typeof useSessionHealthBarPresentation>;
  const errors: Error[] = [];
  const completionKeys = new Set<string>();
  function Probe() {
    if (++renders > 200) throw new Error('Health probe did not settle');
    const [completion, setCompletion] = React.useState<ResolvedHealthCompletionIdentity | null>(null);
    receipt = completion;
    if (completion) completionKeys.add(completion.presentationKey);
    view = useSessionHealthBarPresentation({ ...structuredClone(input), canAccept: true, onComplete: setCompletion, scheduler: clock });
    return null;
  }
  const render = mountProbe(Probe, errors);
  for (const [turn, terminal] of [[17, false], [18, false], [19, true]] as const) {
    input = healthInput(turn, terminal);
    await render();
    await React.act(async () => { clock.advance(60_000); });
    await React.act(async () => { clock.advance(60_000); });
    expect(view!.presentationComplete).toBe(true);
    expect(receipt).toMatchObject({ presentationKey: `g::health::${turn}` });
    const completed = receipt;
    input.presentation = null;
    for (let repeat = 0; repeat < 5; repeat += 1) await render();
    expect(receipt).toBe(completed);
    if (terminal) expect(view!.outcome).toMatchObject({ left: { letters: 'V' }, right: { letters: 'L' }, opacity: 1 });
  }
  expect(completionKeys.size).toBe(3);
  expect(clock.frames.size).toBe(0);
  assertHealthy(errors);
});
