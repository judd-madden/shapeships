import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardStatHover } from '../../layout/boardStage/useBoardStatHover';
import { DesktopDicePresentation, type DesktopDicePresentationProps } from '../../layout/boardStage/DesktopDicePresentation';
import { BoardStage } from '../../layout/BoardStage';
import { MainStage } from '../../layout/MainStage';
import { HealthBarPair } from '../../healthBars/HealthBar';
import { prepareHealthBarOutcome } from '../../healthBars/healthBarOutcomePresentation';

// Run the real callbacks/effect lifecycles with element doubles, without a browser dependency.
const hooks = vi.hoisted(() => {
  type Cell = { value: any; deps?: readonly unknown[]; cleanup?: () => void; ready?: boolean };
  const cells: Cell[] = [];
  const layout: Array<() => void> = [];
  const passive: Array<() => void> = [];
  let index = 0;
  const cell = (value?: unknown) => cells[index++] ?? (cells[index - 1] = { value });
  const changed = (old: readonly unknown[] | undefined, next: readonly unknown[] | undefined) =>
    !old || !next || old.length !== next.length || next.some((value, i) => !Object.is(value, old[i]));
  const effect = (queue: Array<() => void>, callback: () => void | (() => void), deps?: readonly unknown[]) => {
    const entry = cell();
    if (entry.ready && !changed(entry.deps, deps)) return;
    entry.ready = true;
    entry.deps = deps;
    queue.push(() => {
      entry.cleanup?.();
      entry.cleanup = callback() || undefined;
    });
  };
  return {
    begin: () => { index = 0; },
    flush: () => { layout.splice(0).forEach((run) => run()); passive.splice(0).forEach((run) => run()); },
    reset: () => { cells.length = 0; layout.length = 0; passive.length = 0; index = 0; },
    unmount: () => cells.forEach((entry) => entry.cleanup?.()),
    useState: (initial: unknown) => {
      const entry = cell();
      if (!entry.ready) { entry.value = typeof initial === 'function' ? initial() : initial; entry.ready = true; }
      return [entry.value, (value: any) => { entry.value = typeof value === 'function' ? value(entry.value) : value; }];
    },
    useRef: (initial: unknown) => cell({ current: initial }).value,
    useCallback: (callback: unknown, deps: readonly unknown[]) => {
      const entry = cell(callback);
      if (changed(entry.deps, deps)) { entry.value = callback; entry.deps = deps; }
      return entry.value;
    },
    useMemo: (compute: () => unknown, deps: readonly unknown[]) => {
      const entry = cell();
      if (!entry.ready || changed(entry.deps, deps)) { entry.value = compute(); entry.deps = deps; entry.ready = true; }
      return entry.value;
    },
    useEffect: (callback: () => void | (() => void), deps?: readonly unknown[]) => effect(passive, callback, deps),
    useLayoutEffect: (callback: () => void | (() => void), deps?: readonly unknown[]) => effect(layout, callback, deps),
  };
});

vi.mock('react', async (importOriginal) => ({ ...await importOriginal<typeof import('react')>(), ...hooks }));
vi.mock('../../shared/useHoverPanelPresence', () => ({
  useHoverPanelPresence: (value: unknown) => ({ presentValue: value, motionState: null }),
}));
vi.mock('../../../../components/ui/primitives', () => ({ Dice: () => null }));
vi.mock('../../../../graphics/ancient/Cube', () => ({ Cube: () => null }));
vi.mock('../../../data/ShipDefinitionsUI', () => ({ getShipDefinitionUI: () => null }));
vi.mock('../../graphics/resolveShipGraphic', () => ({ resolveShipGraphic: () => null }));

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

class ElementDouble {
  isConnected = true;
  disabled = false;
  bounds = rect(400, 200, 64, 64);
  getBoundingClientRect = () => this.bounds;
  // Deliberately no dataset, parentElement, closest or querySelector.
}

class ObserverDouble {
  static instances: ObserverDouble[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(readonly notify: () => void) { ObserverDouble.instances.push(this); }
}

const ref = (element: ElementDouble) => ({ current: element as unknown as HTMLDivElement });
let boardRootRef: ReturnType<typeof ref>;
let barRegionRef: ReturnType<typeof ref>;
let viewport: {
  innerWidth: number; innerHeight: number;
  setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout;
  addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn>;
};

function render<T>(component: () => T, commit?: (result: T) => void): T {
  hooks.begin();
  const result = component();
  commit?.(result);
  hooks.flush();
  return result;
}

function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const element = child as ReactElement<any>;
    return [element, ...elements(element.props.children)];
  });
}

beforeEach(() => {
  hooks.reset();
  vi.useFakeTimers();
  ObserverDouble.instances = [];
  boardRootRef = ref(new ElementDouble());
  barRegionRef = ref(new ElementDouble());
  viewport = {
    innerWidth: 1000, innerHeight: 800, setTimeout, clearTimeout,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', viewport);
  vi.stubGlobal('ResizeObserver', ObserverDouble);
  vi.stubGlobal('HTMLButtonElement', ElementDouble);
});

afterEach(() => {
  hooks.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('desktop lower-row reservations', () => {
  type Props = Parameters<typeof BoardStage>[0];
  const baseBoard = {
    mode: 'board', mySpeciesId: 'human', opponentSpeciesId: 'human', turnNumber: 1,
    myHealth: 20, opponentHealth: 24, myBonusLines: 2, opponentBonusLines: 3,
    myBonusLinesOnEven: 0, opponentBonusLinesOnEven: 0,
    myDisplayedSavedLines: 4, opponentDisplayedSavedLines: 5,
    myDisplayedSavedJoiningLines: 0, opponentDisplayedSavedJoiningLines: 0,
    myJoiningBonusLines: 0, opponentJoiningBonusLines: 0,
    myBonusBreakdownRows: [], opponentBonusBreakdownRows: [], fleetAnim: { my: [], opponent: [] },
    presentedFleetValue: { my: 9, opponent: 10 }, showTurnStartEconomyPresentation: true,
  };
  const read = (overrides = {}, desktopHealthPresentation: Props['desktopHealthPresentation'] = null) => render(() => BoardStage({
    vm: { ...baseBoard, ...overrides }, viewer: { isSpectator: false },
    thisTurn: null, presentedThisTurnStats: null, gameStats: null, desktopHealthPresentation,
    desktopDicePresentation: {}, hudVm: {}, actions: {}, phaseKey: 'build.drawing', matchupIntro: null,
    winStreak: { appliedBonus: { turnOneHoverEligible: false } },
  } as unknown as Props)) as ReactElement<any>;
  const rows = (tree: ReactElement<any>) => elements(tree.props.statsContent).filter((element) =>
    ['Saved Lines Group', 'Bonus Group', 'Fleet Value Group'].includes(element.props['data-name']));

  it('forwards the session-owned outcome to the desktop pair without a layout-owned fade', () => {
    const pair = prepareHealthBarOutcome({ gameId: 'g', viewerId: 'a', viewerRole: 'player', leftPlayerId: 'a', rightPlayerId: 'b' },
      { isTerminal: true, winnerPlayerId: 'b', resultReason: 'narrow' })!;
    const outcome = { ...pair, opacity: 0.5 };
    const tree = read({}, { numbers: { left: -5, right: 0 }, left: { health: -5 }, right: { health: 0 },
      scale: { leftCap: { value: 35 }, rightCap: { value: 35 } }, sequence: null, outcome,
    } as unknown as Props['desktopHealthPresentation']);
    const bars = elements(tree.props.healthBars).find((node) => node.type === HealthBarPair)!;
    expect(bars.props.outcome).toBe(outcome);
  });

  it('renders separate rounded health numbers and accessibility text while rectangles are below zero', () => {
    const tree = read({}, { numbers: { left: 21.6, right: 24 }, left: { health: -10 }, right: { health: 18 },
      scale: { leftCap: { value: 35 }, rightCap: { value: 35 } }, sequence: null,
      delta: { left: -2, right: 4, visible: false, key: 'resolution' } } as unknown as Props['desktopHealthPresentation']);
    const markup = renderToStaticMarkup(tree.props.healthContent);
    expect(markup).toContain('Health 22, maximum 35');
    expect(markup).toContain('>22</span>');
    expect(markup).not.toContain('Health -10');
    expect(markup).toContain('min-h-[1em]');
  });

  it('keeps the same row envelopes with joining metrics absent/present and one/two-line labels', () => {
    const plain = read();
    const reserved = rows(plain).map((element) => element.props.className);
    const joining = read({ mySpeciesId: 'centaur', myBonusLinesOnEven: 2,
      myDisplayedSavedJoiningLines: 3, opponentDisplayedSavedJoiningLines: 2,
      myJoiningBonusLines: 1, opponentJoiningBonusLines: 1 });
    expect(rows(joining).map((element) => element.props.className)).toEqual(reserved);
    const saved = renderToStaticMarkup(rows(joining)[0]);
    const bonus = renderToStaticMarkup(rows(joining)[1]);
    expect(saved).toContain('[--ss-metric-label-lines:1]');
    expect(bonus).toContain('[--ss-metric-label-lines:2]');
    expect(saved).toContain('JOINING');
    expect(bonus).toContain('ON EVEN');
    expect(bonus).toContain('min-h-[calc(var(--ss-metric-label-lines)*1lh)]');
    const plainSaved = renderToStaticMarkup(rows(plain)[0]);
    expect(plainSaved).not.toContain('JOINING');
    expect(plainSaved).toContain('<p aria-hidden="true"');
    // Component/style coverage only; rendered geometry requires owner browser review.
  });

  it('keeps empty gated rows and separators without values, focus targets or misleading accessible labels', () => {
    const shown = read();
    const withheld = read({ showTurnStartEconomyPresentation: false });
    expect(rows(withheld).map((element) => element.props.className))
      .toEqual(rows(shown).map((element) => element.props.className));
    for (const row of rows(withheld)) {
      expect(Children.count(row.props.children)).toBe(0);
      const markup = renderToStaticMarkup(row);
      expect(markup).not.toMatch(/tabindex|aria-label|<span|<p|<button/);
    }
    const spacerClasses = (tree: ReactElement<any>) => elements(tree.props.statsContent)
      .filter((element) => element.type === 'div' && element.props['aria-hidden']).map((element) => element.props.className);
    expect(spacerClasses(withheld)).toEqual(spacerClasses(shown));
    const fleet = rows(read({ presentedFleetValue: null }))[2];
    expect(fleet.props.className).toContain('hidden min-h-[18px]');
    expect(fleet.props.className).toContain('min-[1400px]:flex');
    expect(Children.count(fleet.props.children)).toBe(0);
  });

  it('preserves outward bonus anchors and explicit board/bar refs and responsive value-height tiers', () => {
    const tree = read({ opponentJoiningBonusLines: 1 });
    expect(tree.props.boardRootRef).toBeDefined();
    expect(tree.props.barRegionRef).toBeDefined();
    const anchors = elements(tree.props.statsContent).filter((element) => element.props.hoverKey);
    expect(anchors.map((element) => element.props.hoverKey)).toEqual(['my-bonus', 'opponent-bonus']);
    expect(anchors.every((element) => element.props.className.includes('w-max shrink-0'))).toBe(true);
    const opponentJoining = elements(anchors[1].props.children).find((element) =>
      (element as any).ref === anchors[1].props.anchorRef);
    expect(opponentJoining).toBeDefined();
    const frame = (tree.type as (props: any) => ReactElement<any>)(tree.props);
    const stack = elements(frame).find((element) => element.props['data-name'] === 'Existing Board Stats')!;
    for (const tier of ['[--ss-metric-value-height:20px]', 'min-[1400px]:[--ss-metric-value-height:24px]',
      'min-[1920px]:[--ss-metric-value-height:28px]', 'min-[2220px]:[--ss-metric-value-height:32px]']) {
      expect(stack.props.className).toContain(tier);
    }
    expect(elements(frame).find((element) => element.props['data-name'] === 'Desktop Health Bar Region')!.props.className)
      .toContain('min-h-[42px] basis-0 grow');
  });
});

describe('terminal Mission number coordination', () => {
  it('keeps an opened result behind the number tail even when deltas are visible', () => {
    const presentation = { sequence: { snapshot: { outcome: { isTerminal: true } } },
      delta: { visible: true }, presentationComplete: false };
    const props = {
      gameId: 'g', boardVm: { mode: 'board' }, viewer: { isPlayerViewer: true },
      desktopHealthPresentation: presentation, desktopDicePresentation: {},
      actionPanelVm: { activePanelId: 'ap.end_of_game.result', tabs: [], menu: { phaseKey: 'game.finished' } },
      missionChallenge: { mission: { id: 'm' }, isFinished: true, result: { missionSucceeded: true } },
      gameStats: null, actions: {},
    } as unknown as Parameters<typeof MainStage>[0];
    const read = () => render(() => MainStage(props));
    let tree = read();
    const actionPanel = elements(tree).find((element) => element.props.onTogglePostgameChallenge)!;
    actionPanel.props.onTogglePostgameChallenge();
    tree = read();
    expect(elements(tree).some((element) => element.props.mode === 'result')).toBe(false);
    presentation.presentationComplete = true;
    tree = read();
    expect(elements(tree).some((element) => element.props.mode === 'result')).toBe(true);
  });
});

describe('explicit desktop stat layout refs', () => {
  const renderHover = () => render(() => useBoardStatHover({ boardRootRef, barRegionRef }));

  it('observes supplied elements and remeasures on layout resize, viewport resize and captured scroll', () => {
    const trigger = new ElementDouble();
    let hover = renderHover();
    hover.onEnter('my-health', trigger as unknown as HTMLElement);
    hover = renderHover();
    const observer = ObserverDouble.instances.at(-1)!;
    expect(observer.observe.mock.calls.map(([element]) => element)).toEqual([trigger, boardRootRef.current, barRegionRef.current]);
    trigger.bounds = rect(400, 260, 64, 64);
    observer.notify();
    expect(renderHover().state.anchorRect?.top).toBe(260);
    for (const [name, listener, capture] of viewport.addEventListener.mock.calls) {
      expect(capture).toBe(name === 'scroll' ? true : undefined);
      trigger.bounds = rect(420, name === 'scroll' ? 300 : 280, 64, 64);
      listener();
      expect(renderHover().state.anchorRect?.top).toBe(trigger.bounds.top);
    }
    hooks.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(viewport.removeEventListener.mock.calls).toEqual(viewport.addEventListener.mock.calls);
    hooks.reset();
  });

  it.each(['disconnected', 'disabled'])('clears a %s anchor and releases observers', (kind) => {
    const trigger = new ElementDouble();
    renderHover().onFocus('my-bonus', trigger as unknown as HTMLElement);
    renderHover();
    const observer = ObserverDouble.instances.at(-1)!;
    if (kind === 'disconnected') trigger.isConnected = false;
    else trigger.disabled = true;
    observer.notify();
    expect(renderHover().state.activeKey).toBeNull();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('retains the 150ms handoff and keyboard/card focus continuity', () => {
    const trigger = new ElementDouble();
    let hover = renderHover();
    hover.onEnter('my-current', trigger as unknown as HTMLElement);
    hover = renderHover();
    hover.onLeave('my-current');
    vi.advanceTimersByTime(149);
    expect(renderHover().state.activeKey).toBe('my-current');
    hover.onCardEnter('my-current');
    vi.advanceTimersByTime(1);
    expect(renderHover().state.activeKey).toBe('my-current');
    hover.onCardFocus('my-current');
    hover.onCardLeave('my-current');
    vi.advanceTimersByTime(150);
    expect(renderHover().state.activeKey).toBe('my-current');
    hover.onCardBlur('my-current');
    vi.advanceTimersByTime(150);
    expect(renderHover().state.activeKey).toBeNull();
  });
});

describe('explicit desktop guidance layout refs', () => {
  const die = new ElementDouble();
  const card = new ElementDouble();
  const props = (overrides: Partial<DesktopDicePresentationProps> = {}) => ({
    boardRootRef, barRegionRef, diceValue: 3 as const, diceAnimateKey: 1,
    diceManipulationSlots: { left: [], right: [] }, firstTurnBuildHelperEligible: true,
    ...overrides,
  });
  const renderDice = (overrides: Partial<DesktopDicePresentationProps> = {}) => render(
    () => DesktopDicePresentation(props(overrides)),
    (tree) => elements(tree).filter((element) => (element as any).ref).forEach((element, index) => {
      (element as any).ref.current = index === 0 ? die : card;
    }),
  );
  const guidance = (tree: ReactNode) => elements(tree).find((element) => element.props['aria-hidden'] !== undefined);

  beforeEach(() => { die.bounds = rect(400, 200, 64, 64); card.bounds = rect(0, 0, 290, 160); });

  it('remeasures guidance from bar/root resize, flips/clamps and cleans up', () => {
    renderDice();
    renderDice();
    const observer = ObserverDouble.instances.at(-1)!;
    expect(observer.observe.mock.calls.map(([element]) => element)).toEqual([card, die, boardRootRef.current, barRegionRef.current]);
    let tree = renderDice();
    expect(guidance(tree)?.props.style).toMatchObject({ left: 76, top: -24 });
    die.bounds = rect(900, 760, 64, 64);
    observer.notify();
    tree = renderDice();
    expect(guidance(tree)?.props.style).toMatchObject({ left: -302, top: -132 });
    viewport.innerWidth = 600;
    viewport.innerHeight = 400;
    viewport.addEventListener.mock.calls.find(([name]) => name === 'resize')![1]();
    expect(guidance(renderDice())?.props.style).toMatchObject({ left: -602, top: -532 });
    hooks.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(viewport.removeEventListener.mock.calls).toEqual(viewport.addEventListener.mock.calls);
    expect(vi.getTimerCount()).toBe(0);
    hooks.reset();
  });

  it('keeps the appearance delay through setup/overlay suppression and retains dismissal fade', () => {
    renderDice({ guidanceSuppressed: true });
    renderDice({ guidanceSuppressed: true });
    vi.advanceTimersByTime(499);
    expect(guidance(renderDice({ guidanceSuppressed: true }))?.props.style.opacity).toBe(0);
    vi.advanceTimersByTime(1);
    expect(guidance(renderDice({ guidanceSuppressed: true }))?.props.style.visibility).toBe('hidden');
    // Revealing the same mounted die does not restart the eligibility timer.
    expect(guidance(renderDice())?.props.style.opacity).toBe(1);
    renderDice({ firstTurnBuildHelperDismissSignal: 1 });
    expect(guidance(renderDice({ firstTurnBuildHelperDismissSignal: 1 }))?.props.style.opacity).toBe(0);
    vi.advanceTimersByTime(149);
    expect(guidance(renderDice({ firstTurnBuildHelperDismissSignal: 1 }))).toBeDefined();
    vi.advanceTimersByTime(1);
    expect(guidance(renderDice({ firstTurnBuildHelperDismissSignal: 1 }))).toBeUndefined();
  });
});
