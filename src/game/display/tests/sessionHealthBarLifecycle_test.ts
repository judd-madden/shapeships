import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSessionViewModel } from '../../client/gameSession/types';
import { captureResolvedHealthSnapshot, prepareResolvedHealthCapture, isTerminalHealthBarPresentationPending } from '../../client/gameSession/resolvedHealth';
import { useEndOfTurnPresentation } from '../../client/gameSession/clienteffects/useEndOfTurnPresentation';
import GameScreen from '../GameScreen';
import { HEALTH_BAR_ANIMATION_CONFIG } from '../healthBars/healthBarAnimationConfig';
import {
  useDesktopHealthBarAxisLength, useDesktopHealthBarLegend, useHealthBarLegend,
  useMobileHealthBarAxisLength, useSessionHealthBarPresentation,
} from '../healthBars/useSessionHealthBarPresentation';

// Existing repo approach: execute production hook lifecycles with element/media doubles.
const hooks = vi.hoisted(() => {
  type Cell = { value?: any; deps?: readonly unknown[]; cleanup?: () => void; setup?: () => void | (() => void) };
  const cells: Cell[] = []; let index = 0;
  const layout: Array<() => void> = []; const passive: Array<() => void> = [];
  const cell = () => cells[index++] ?? (cells[index - 1] = {});
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) => !a || !b || a.length !== b.length || b.some((v, i) => !Object.is(v, a[i]));
  const effect = (queue: Array<() => void>, setup: () => void | (() => void), deps?: readonly unknown[]) => {
    const entry = cell();
    if (!changed(entry.deps, deps)) return;
    entry.deps = deps; entry.setup = setup;
    queue.push(() => { entry.cleanup?.(); entry.cleanup = setup() || undefined; });
  };
  return {
    begin: () => { index = 0; },
    flush: () => { layout.splice(0).forEach((run) => run()); passive.splice(0).forEach((run) => run()); },
    reset: () => { cells.length = 0; index = 0; layout.length = 0; passive.length = 0; },
    unmount: () => cells.forEach((entry) => { entry.cleanup?.(); entry.cleanup = undefined; }),
    reattach: () => {
      cells.forEach((entry) => entry.cleanup?.());
      cells.forEach((entry) => { if (entry.setup) entry.cleanup = entry.setup() || undefined; });
    },
    useState: (initial: any) => {
      const entry = cell();
      if (!('value' in entry)) entry.value = typeof initial === 'function' ? initial() : initial;
      return [entry.value, (value: any) => { entry.value = typeof value === 'function' ? value(entry.value) : value; }];
    },
    useRef: (initial: unknown) => { const entry = cell(); return entry.value ?? (entry.value = { current: initial }); },
    useMemo: (compute: () => unknown, deps: readonly unknown[]) => {
      const entry = cell(); if (changed(entry.deps, deps)) { entry.value = compute(); entry.deps = deps; } return entry.value;
    },
    useEffect: (setup: () => void | (() => void), deps?: readonly unknown[]) => effect(passive, setup, deps),
    useLayoutEffect: (setup: () => void | (() => void), deps?: readonly unknown[]) => effect(layout, setup, deps),
    useSyncExternalStore: (subscribe: (callback: () => void) => () => void, snapshot: () => unknown) => {
      effect(layout, () => subscribe(() => {}), [subscribe]); return snapshot();
    },
  };
});
const runtime = vi.hoisted(() => ({ mobile: false, vm: null as GameSessionViewModel | null, options: null as any }));
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), ...hooks }));
vi.mock('../../client/useGameSession', () => ({ useGameSession: (_game: string, _name: string, options: unknown) => {
  runtime.options = options; return { vm: runtime.vm, actions: { onReadyToggle: () => {} } };
} }));
vi.mock('../../client/audio/useGameSound', () => ({ useGameSound: () => {} }));
vi.mock('../mobile/useMobileGameLayout', () => ({ useMobileGameLayout: () => runtime.mobile }));
vi.mock('../matchup/useMatchupIntroPresentation', () => ({ useMatchupIntroPresentation: () => null }));
vi.mock('../layout/MainStage', () => ({ MainStage: () => null }));
vi.mock('../mobile/MobileGameLayout', () => ({ MobileGameLayout: () => null }));
vi.mock('../layout/LeftRail', () => ({ LeftRail: () => null }));
vi.mock('../graphics/StarsBackground', () => ({ StarsBackground: () => null }));

class ObserverDouble {
  static instances: ObserverDouble[] = [];
  observe = vi.fn(); disconnect = vi.fn();
  constructor(readonly notify: () => void) { ObserverDouble.instances.push(this); }
}
let now = 0; let serial = 0;
const frames = new Map<number, () => void>();
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
function render<T>(callback: () => T) { hooks.begin(); const result = callback(); hooks.flush(); return result; }
function advance(ms: number) { now += ms; const work = [...frames.values()]; frames.clear(); work.forEach((run) => run()); }
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap((child) => isValidElement(child)
    ? [child as ReactElement<any>, ...elements((child as ReactElement<any>).props.children)] : []);
}
function vm(): GameSessionViewModel {
  const identity = { gameId: 'g', viewerId: 'p1', viewerRole: 'player' as const, leftPlayerId: 'p1', rightPlayerId: 'p2' };
  const outcome = { isTerminal: false, winnerPlayerId: null, resultReason: null };
  const side = (playerId: string) => ({ playerId, startHealth: 30, damageTaken: 10, damageStageHealth: 20,
    grossHealingReceived: 0, finalHealth: 20, actualNetDelta: -10, maxHealth: 35 });
  return {
    isBootstrapping: false, board: { mode: 'board', myVoidFleet: [], opponentVoidFleet: [] },
    actionPanel: { endOfGame: null, menu: { phaseKey: 'build.drawing', canResign: true } },
    leftRail: { turn: 4 }, viewer: { isSpectator: false, isPlayerViewer: true }, missionChallenge: null,
    resolvedHealth: { mode: 'live', snapshot: { identity, outcome, continuityKey: 'ctx',
      presentationKey: 'g::health::3', resolvedTurnNumber: 3, source: 'poll', eligibility: 'live',
      left: side('p1'), right: side('p2') } },
    resolvedHealthSession: { identity, continuityKey: 'ctx', observedResolvedTurnNumber: 3,
      settled: { mode: 'settled', identity, outcome,
        left: { playerId: 'p1', health: 20, maxHealth: 35 }, right: { playerId: 'p2', health: 20, maxHealth: 35 } } },
  } as unknown as GameSessionViewModel;
}

beforeEach(() => {
  hooks.reset(); now = 0; serial = 0; frames.clear(); ObserverDouble.instances = [];
  runtime.mobile = false; runtime.vm = vm();
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('window', { matchMedia: () => media, localStorage: { getItem: () => null, setItem: () => {} },
    addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.set(++serial, callback); return serial; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('ResizeObserver', ObserverDouble);
});
afterEach(async () => { hooks.unmount(); await Promise.resolve(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('session health presentation hooks and entry wiring', () => {
  it('reports terminal completion only after the number tail, independent of delta reveal and layout remounts', () => {
    const input = runtime.vm!;
    if (input.resolvedHealth?.mode !== 'live') throw new Error('Expected live facts');
    const snapshot = { ...input.resolvedHealth.snapshot,
      outcome: { isTerminal: true, winnerPlayerId: 'p1', resultReason: 'decisive' } };
    let source: GameSessionViewModel['resolvedHealth'] = { mode: 'live', snapshot };
    const completed = vi.fn();
    let canAccept = true;
    const read = () => render(() => useSessionHealthBarPresentation({ presentation: source,
      session: input.resolvedHealthSession, canAccept, onComplete: completed }));
    read(); const sequence = read()!.sequence!;
    advance(sequence.durationMs);
    expect(read()!.delta?.visible).toBe(true);
    expect(read()!.numbers).toEqual({ left: 30, right: 30 });
    expect(read()!.presentationComplete).toBe(false);
    expect(completed).not.toHaveBeenCalled();
    expect(isTerminalHealthBarPresentationPending({ enabled: true, continuityKey: snapshot.continuityKey,
      snapshot, completion: null })).toBe(true);
    // Conditional children may disappear, source may release and acceptance may close.
    source = input.resolvedHealthSession!.settled;
    canAccept = false;
    advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    expect(read()!.numbers.left).toBeCloseTo(25);
    hooks.reattach();
    expect(read()!.numbers.left).toBeCloseTo(25);
    advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    expect(read()!.numbers).toEqual({ left: 20, right: 20 });
    expect(read()!.presentationComplete).toBe(true);
    expect(completed).toHaveBeenCalledOnce();
    expect(isTerminalHealthBarPresentationPending({ enabled: true, continuityKey: snapshot.continuityKey,
      snapshot, completion: completed.mock.calls[0][0] })).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('publishes exact live facts on the capture commit and keeps animating after real dice publication and settlement', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const context = runtime.vm!.resolvedHealthSession!;
    const response = { gameId: 'g', turnNumber: 4, phaseKey: 'build.drawing', status: 'active',
      players: [{ id: 'p1', role: 'player', health: 20, maxHealth: 50 }, { id: 'p2', role: 'player', health: 20, maxHealth: 35 }],
      gameData: { lastTurnHealthResolution: { resolvedTurnNumber: 3,
        finalHealthByPlayerId: { p1: 20, p2: 20 }, maxHealthByPlayerId: { p1: 35, p2: 35 } },
        lastTurnDamageByPlayerId: { p1: 10, p2: 10 }, lastTurnHealByPlayerId: { p1: 0, p2: 0 },
        lastTurnNetByPlayerId: { p1: -10, p2: -10 },
        phaseReadiness: [{ playerId: 'p2', isReady: true }], turnData: { shipsMadeThisTurnByPlayerId: { p2: 1 } } },
    };
    const prepared = prepareResolvedHealthCapture({ state: response, identity: context.identity,
      continuityKey: context.continuityKey, resolvedTurnNumber: 3, source: 'intent' })!;
    const candidate = captureResolvedHealthSnapshot({ ...prepared, liveCapture: prepared })!;
    expect(candidate).not.toBeNull();
    const args: Parameters<typeof useEndOfTurnPresentation>[0] = {
      effectiveGameId: 'g', hasMatchingAuthoritativeGameId: true, phaseKey: 'build.drawing', turnNumber: 3,
      isFinished: false, isBootstrapping: false, authoritativeHoldPhaseKey: null,
      authoritativeHoldReason: null, authoritativeHoldUntilMs: null, resolvedHealthCandidate: null,
      resolvedHealthContinuityKey: context.continuityKey, resolvedHealthPendingTurnNumber: null,
      healthPresentation: { boardMode: 'board', viewerRole: 'player', meName: 'One', opponentName: 'Two',
        myHealth: 20, opponentHealth: 20, myMaxHealth: 50, opponentMaxHealth: 35, hasExplicitProjectedMaxHealth: true,
        myLastTurnNet: -10, opponentLastTurnNet: -10, spectatorHasTwoPlayers: false,
        spectatorLeftName: '', spectatorRightName: '', spectatorLeftNet: 0, spectatorRightNet: 0 },
      leftRail: { authoritativeDiceValue: 3, authoritativeDiceSignature: 'g:3:3',
        authoritativeChronoswarmRolls: [], authoritativeCubeDiceValueByPlayerId: {} },
      economyPresentation: null, continueAuthoritativePhaseHold: async () => 'released',
    };
    const complete = vi.fn();
    const read = () => render(() => {
      const runtime = useEndOfTurnPresentation(args);
      const view = useSessionHealthBarPresentation({
        presentation: runtime.resolvedHealthSnapshot ? { mode: 'live', snapshot: runtime.resolvedHealthSnapshot } : context.settled,
        session: context, canAccept: true, onComplete: complete,
      });
      return { runtime, view };
    });
    read(); read();
    args.turnNumber = 4;
    args.resolvedHealthCandidate = candidate;
    args.resolvedHealthPendingTurnNumber = 3;
    args.leftRail = { ...args.leftRail, authoritativeDiceValue: 4, authoritativeDiceSignature: 'g:4:4' };
    expect(read().runtime.resolvedHealthSnapshot).toBe(candidate);
    const sequence = read().view!.sequence!;
    const damage = sequence.stages.find((stage) => stage.name === 'damage')!;
    advance(damage.startMs + damage.durationMs / 2);
    vi.advanceTimersByTime(10000);
    read();
    const released = read();
    expect(released.runtime.resolvedHealthSnapshot).toBeNull();
    expect(released.runtime.presentedTurnDiceSettledTurnNumber).toBe(4);
    expect(released.runtime.healthResolutionLockActive).toBe(false);
    expect(released.view!.sequence).toBe(sequence);
    expect(released.view!.left.health).toBeLessThan(30);
    expect(released.view!.left.health).toBeGreaterThan(20);
    expect(released.view!.delta?.visible).toBe(false);
    for (const phase of ['build.drawing', 'battle.reveal']) {
      args.phaseKey = phase;
      advance(25);
      expect(read().view!.sequence).toBe(sequence);
    }
    advance(sequence.durationMs);
    read();
    expect(read().view!.delta).toMatchObject({ left: -10, right: -10, visible: true });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ resolvedTurnNumber: 3 }));
  });

  it('keeps one live owner and terminal gate across desktop/mobile switches, including the number tail', () => {
    const input = runtime.vm!;
    if (input.resolvedHealth?.mode !== 'live') throw new Error('Expected live facts');
    input.resolvedHealth = { mode: 'live', snapshot: { ...input.resolvedHealth.snapshot,
      outcome: { isTerminal: true, winnerPlayerId: 'p1', resultReason: 'decisive' } } };
    const screen = () => render(() => GameScreen({ gameId: 'g', playerName: 'Player', onBack: () => {} }));
    screen();
    let tree = screen();
    const desktop = () => elements(tree).find((element) => 'desktopHealthPresentation' in element.props)!;
    const sequence = desktop().props.desktopHealthPresentation.sequence;
    const mobile = () => elements(tree).find((element) => 'healthBarPresentation' in element.props)!;
    advance(250);
    runtime.mobile = true; tree = screen();
    expect(runtime.options.healthBarsEnabled).toBe(true);
    expect(elements(tree).some((element) => 'desktopHealthPresentation' in element.props)).toBe(false);
    expect(mobile().props.boardVm).toBe(runtime.vm!.board);
    expect(mobile().props.healthBarPresentation.sequence).toBe(sequence);
    expect(mobile().props.healthBarPresentation.scale.orientation).toBe('mobile');
    const moving = mobile().props.healthBarPresentation;
    runtime.mobile = false; tree = screen();
    expect(runtime.options.healthBarsEnabled).toBe(true);
    expect(desktop().props.desktopHealthPresentation.sequence).toBe(sequence);
    expect(desktop().props.desktopHealthPresentation.left).toBe(moving.left);
    expect(desktop().props.desktopHealthPresentation.numbers).toBe(moving.numbers);
    expect(frames.size).toBe(1);
    expect(desktop().props.desktopHealthPresentation.left.health).toBeLessThan(30);
    advance(sequence.durationMs - 250);
    tree = screen();
    expect(desktop().props.desktopHealthPresentation.delta.visible).toBe(true);
    expect(runtime.options.healthBarCompletion).toBeNull();
    advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    runtime.mobile = true; tree = screen();
    expect(mobile().props.healthBarPresentation.numbers.left).toBeCloseTo(25);
    expect(mobile().props.healthBarPresentation.sequence).toBe(sequence);
    expect(runtime.options.healthBarCompletion).toBeNull();
    runtime.mobile = false; tree = screen();
    expect(desktop().props.desktopHealthPresentation.numbers.left).toBeCloseTo(25);
    runtime.mobile = true; tree = screen();
    advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    tree = screen(); tree = screen();
    expect(mobile().props.healthBarPresentation.numbers).toEqual({ left: 20, right: 20 });
    expect(mobile().props.healthBarPresentation.presentationComplete).toBe(true);
    expect(runtime.options.healthBarCompletion).toMatchObject({ presentationKey: sequence.snapshot.presentationKey });
    expect(isTerminalHealthBarPresentationPending({ enabled: runtime.options.healthBarsEnabled,
      continuityKey: sequence.snapshot.continuityKey, snapshot: sequence.snapshot,
      completion: runtime.options.healthBarCompletion })).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('rejects a stale terminal receipt after a newer mobile resolution or recovery', () => {
    runtime.mobile = true;
    const input = runtime.vm!;
    if (input.resolvedHealth?.mode !== 'live') throw new Error('Expected live facts');
    const terminal = { ...input.resolvedHealth.snapshot,
      outcome: { isTerminal: true, winnerPlayerId: 'p1', resultReason: 'decisive' } };
    input.resolvedHealth = { mode: 'live', snapshot: terminal };
    const screen = () => render(() => GameScreen({ gameId: 'g', playerName: 'Player', onBack: () => {} }));
    screen(); screen(); advance(100000); screen(); screen();
    const oldReceipt = runtime.options.healthBarCompletion;
    const newer = { ...terminal, resolvedTurnNumber: 4, presentationKey: 'g::health::4' };
    input.resolvedHealth = { mode: 'live', snapshot: newer };
    input.resolvedHealthSession = { ...input.resolvedHealthSession!, observedResolvedTurnNumber: 4 };
    screen(); screen();
    expect(isTerminalHealthBarPresentationPending({ enabled: true, continuityKey: newer.continuityKey,
      snapshot: newer, completion: oldReceipt })).toBe(true);
    const recovered = { ...newer, continuityKey: 'recovered' };
    expect(isTerminalHealthBarPresentationPending({ enabled: true, continuityKey: 'recovered',
      snapshot: recovered, completion: oldReceipt })).toBe(true);
    input.resolvedHealth = input.resolvedHealthSession.settled;
    input.resolvedHealthSession = { ...input.resolvedHealthSession, continuityKey: 'recovered' };
    const tree = screen();
    const view = elements(tree).find((element) => 'healthBarPresentation' in element.props)!.props.healthBarPresentation;
    expect(view.sequence).toBeNull();
    expect(view.numbers).toEqual({ left: 20, right: 20 });
    expect(frames.size).toBe(0);
  });

  it('observes the existing outer region, subtracts padding and disconnects without changing playback', () => {
    let height = 104;
    const region = { getBoundingClientRect: () => ({ height }) };
    const ref = { current: region as unknown as HTMLDivElement };
    const measure = () => render(() => useDesktopHealthBarAxisLength(ref));
    measure(); expect(measure()).toBe(100);
    const observer = ObserverDouble.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(region);
    height = 504; observer.notify(); expect(measure()).toBe(500);
    height = 2; observer.notify(); expect(measure()).toBe(0);
    hooks.unmount(); expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('measures the mobile left column width and thins its legend without altering playback', () => {
    let width = 260;
    const region = { getBoundingClientRect: () => ({ width, height: 38 }) };
    const ref = { current: region as unknown as HTMLDivElement };
    const input = runtime.vm!;
    const read = () => render(() => {
      const view = useSessionHealthBarPresentation({ presentation: input.resolvedHealth,
        session: input.resolvedHealthSession, canAccept: true, orientation: 'mobile', onComplete: () => {} });
      const length = useMobileHealthBarAxisLength(ref);
      return { view, length, labels: useHealthBarLegend(view, length, 'mobile') };
    });
    read(); let current = read();
    const sequence = current.view!.sequence;
    const observer = ObserverDouble.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(region);
    expect(current.length).toBe(256);
    const dense = current.labels!.length;
    advance(200); current = read(); const frame = current.view!.left;
    width = 54; observer.notify(); current = read();
    expect(current.length).toBe(50);
    expect(current.labels!.length).toBeLessThan(dense);
    expect(current.labels!.some((label) => label.value === 0)).toBe(true);
    expect(current.view!.sequence).toBe(sequence);
    expect(current.view!.left).toBe(frame);
    expect(frames.size).toBe(1);
    width = 2; observer.notify(); expect(read().length).toBe(0);
    hooks.unmount(); expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('honors reduced motion and removes the media listener and frame on unmount', async () => {
    const input = runtime.vm!;
    const completed = vi.fn();
    const read = () => render(() => useSessionHealthBarPresentation({ presentation: input.resolvedHealth,
      session: input.resolvedHealthSession, canAccept: true, onComplete: completed }));
    read(); advance(200); read();
    expect(frames.size).toBe(1);
    media.matches = true; media.addEventListener.mock.calls[0][1]();
    const view = read()!;
    expect(view.left.health).toBe(20);
    expect(view.delta?.visible).toBe(true);
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ presentationKey: 'g::health::3' }));
    hooks.unmount(); await Promise.resolve();
    expect(media.removeEventListener.mock.calls).toEqual(media.addEventListener.mock.calls);
    expect(frames.size).toBe(0);
  });

  it('retains the mounted controller through actual effect reattachment and caches legend endpoints across frames', async () => {
    const input = runtime.vm!;
    const read = () => render(() => {
      const view = useSessionHealthBarPresentation({ presentation: input.resolvedHealth,
        session: input.resolvedHealthSession, canAccept: true, onComplete: () => {} });
      return { view, labels: useDesktopHealthBarLegend(view, 200) };
    });
    read(); const sequence = read().view!.sequence;
    hooks.reattach(); await Promise.resolve();
    advance(200);
    const frame = read();
    expect(frame.view!.sequence).toBe(sequence);
    expect(frame.labels?.some((label) => label.value === 0)).toBe(true);
    expect(frames.size).toBe(1);
    hooks.unmount(); await Promise.resolve(); expect(frames.size).toBe(0);
  });
});
