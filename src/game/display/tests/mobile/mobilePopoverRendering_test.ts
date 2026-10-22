import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardViewModel, ResolvedHealthSnapshot, ThisTurnMetricVm, ThisTurnPresentationVm } from '../../../client/gameSession/types';
import { MobileStatBreakdownPopovers } from '../../mobile/MobileStatBreakdownPopovers';
import { MobileStatusRail, MobileStatusRailFrame } from '../../mobile/MobileStatusRail';
import { MobileGameLayout } from '../../mobile/MobileGameLayout';
import { MobileBoardView } from '../../mobile/MobileBoardView';
import { MobileTopNav } from '../../mobile/MobileTopNav';
import { MobileActionPanel } from '../../mobile/actionPanel/MobileActionPanel';
import { MobileEndOfGameActionPanel } from '../../mobile/actionPanel/MobileEndOfGameActionPanel';
import { MobileEndOfGameMenuTakeover } from '../../mobile/takeovers/MobileEndOfGameMenuTakeover';
import { MissionChallengeOverlay } from '../../mission/MissionChallengeOverlay';
import { HealthBar, HealthBarLegend } from '../../healthBars/HealthBar';
import { createHealthBarAnimationController } from '../../healthBars/healthBarAnimationController';
import { HEALTH_BAR_ANIMATION_CONFIG } from '../../healthBars/healthBarAnimationConfig';
import { selectSessionHealthBarPresentation, syncSessionHealthBarController } from '../../healthBars/useSessionHealthBarPresentation';
import { prepareHealthBarOutcome } from '../../healthBars/healthBarOutcomePresentation';
import type { WinStreakGameViewModel } from '../../../client/winStreak/types';

// Existing direct-element tests remain stateless; opt into lifecycle cells for mobile integration.
const lifecycle = vi.hoisted(() => {
  type Cell = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
  const cells: Cell[] = []; const effects: Array<() => void> = [];
  let active = false; let index = 0;
  const cell = () => cells[index++] ?? (cells[index - 1] = {});
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !a || !b || a.length !== b.length || b.some((value, i) => !Object.is(value, a[i]));
  const memo = (compute: () => unknown, deps: readonly unknown[]) => {
    if (!active) return compute();
    const entry = cell();
    if (changed(entry.deps, deps)) { entry.value = compute(); entry.deps = deps; }
    return entry.value;
  };
  const effect = (setup: () => void | (() => void), deps?: readonly unknown[]) => {
    if (!active) return;
    const entry = cell(); if (!changed(entry.deps, deps)) return;
    entry.deps = deps;
    effects.push(() => { entry.cleanup?.(); entry.cleanup = setup() || undefined; });
  };
  return {
    begin: () => { active = true; index = 0; },
    flush: () => { active = false; effects.splice(0).forEach((run) => run()); },
    reset: () => { cells.forEach((entry) => entry.cleanup?.()); cells.length = 0; effects.length = 0; active = false; },
    useState: (initial: any) => {
      const value = () => typeof initial === 'function' ? initial() : initial;
      if (!active) return [value(), vi.fn()];
      const entry = cell(); if (!('value' in entry)) entry.value = value();
      return [entry.value, (next: any) => { entry.value = typeof next === 'function' ? next(entry.value) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!active) return { current: initial };
      const entry = cell(); return entry.value ?? (entry.value = { current: initial });
    },
    useMemo: memo,
    useCallback: (callback: unknown, deps: readonly unknown[]) => memo(() => callback, deps),
    useEffect: effect, useLayoutEffect: effect,
  };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, ...lifecycle };
});

afterEach(() => { lifecycle.reset(); vi.unstubAllGlobals(); });

function render<T>(component: () => T, commit?: (tree: T) => void) {
  lifecycle.begin(); const tree = component(); commit?.(tree); lifecycle.flush(); return tree;
}

type Element = ReactElement<any>;

function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const element = child as Element;
    return [element, ...elements(element.props.children)];
  });
}

function invoke(element: Element): Element {
  return (element.type as (props: unknown) => Element)(element.props);
}

function metric(total: number, source: 'estimated' | 'last_actual', turnNumber: number): ThisTurnMetricVm {
  return {
    state: 'value', total, source, turnNumber, estimateMode: 'with_autocast',
    chargeDeclarationUncertain: source === 'estimated',
    rows: [{ rowKind: 'ship', label: source === 'estimated' ? 'Current source' : 'Previous source', count: 1, amount: total, amountText: `+${total}` }],
  };
}

const pair = (total: number) => ({ current: metric(total, 'estimated', 4), last: metric(total - 1, 'last_actual', 3) });
const presentation: ThisTurnPresentationVm = {
  turnNumber: 4, phaseKey: 'build.drawing', liveLog: null, archiveHandoff: null,
  mobile: { pairKey: 'one::4', opponentDetail: 'last' },
  me: { playerId: 'one', damage: pair(13), healing: pair(5) },
  opponent: { playerId: 'two', damage: pair(20), healing: pair(7) },
};
const board = {
  mode: 'board', mySpeciesId: 'human', opponentSpeciesId: 'centaur',
  myBonusLines: 2, opponentBonusLines: 6, opponentBonusLinesOnEven: 0,
  myBonusBreakdownRows: [], opponentBonusBreakdownRows: [
    { rowKind: 'ship', label: 'Orbital', count: 2, amount: 2, amountText: '2' },
    { rowKind: 'adjustment', label: 'Win streak', amount: 4, amountText: '4' },
  ],
  myDisplayedSavedLines: 3, opponentDisplayedSavedLines: 4,
  myDisplayedSavedJoiningLines: 0, opponentDisplayedSavedJoiningLines: 2,
  myJoiningBonusLines: 0, opponentJoiningBonusLines: 1,
  presentedFleetValue: { my: 42, opponent: 54 },
} as unknown as Extract<BoardViewModel, { mode: 'board' }>;
const winStreak = {
  appliedBonus: { count: 4, recipientSide: 'opponent', turnOneHoverEligible: true },
} as WinStreakGameViewModel;

function props(overrides: Partial<Parameters<typeof MobileStatBreakdownPopovers>[0]> = {}) {
  return {
    boardVm: board, thisTurn: presentation, winStreak, gameStats: null,
    viewer: { viewerMode: 'p1_player' as const, isSpectator: false, isPlayerViewer: true, p1Name: 'Alpha', p2Name: 'Beta' },
    period: 'current' as const, onPeriodChange: vi.fn(), onDismiss: vi.fn(), boardCenterX: 180,
    topAnchorRect: { left: 14, right: 290, top: 250, bottom: 292, width: 276, height: 42 },
    bottomAnchorRect: { left: 14, right: 290, top: 334, bottom: 376, width: 276, height: 42 },
    ...overrides,
  };
}

function frames(input = props()): Element[] {
  return Children.toArray(MobileStatBreakdownPopovers(input).props.children) as Element[];
}

function pointer(clientX: number, clientY: number, pointerId = 1, isPrimary = true) {
  return { clientX, clientY, pointerId, isPrimary, stopPropagation: vi.fn(), preventDefault: vi.fn() };
}

function liveHealth(leftPlayerId = 'one', rightPlayerId = 'two', spectator = false, terminal = false) {
  const identity = { gameId: 'g', viewerId: spectator ? 'watcher' : leftPlayerId,
    viewerRole: spectator ? 'spectator' as const : 'player' as const, leftPlayerId, rightPlayerId };
  const snapshot: ResolvedHealthSnapshot = { identity, continuityKey: 'ctx', presentationKey: 'g::health::3',
    resolvedTurnNumber: 3, eligibility: 'live', source: 'poll',
    outcome: { isTerminal: terminal, winnerPlayerId: terminal ? rightPlayerId : null, resultReason: terminal ? 'decisive' : null },
    left: { playerId: leftPlayerId, startHealth: 22, damageTaken: 33, damageStageHealth: -11,
      grossHealingReceived: 8, finalHealth: -3, actualNetDelta: -25, maxHealth: 35 },
    right: { playerId: rightPlayerId, startHealth: 20, damageTaken: 2, damageStageHealth: 18,
      grossHealingReceived: 6, finalHealth: 24, actualNetDelta: 4, maxHealth: 47 } };
  const source = { mode: 'live' as const, snapshot };
  const session = { identity, continuityKey: 'ctx', observedResolvedTurnNumber: 3,
    settled: { mode: 'settled' as const, identity, outcome: snapshot.outcome,
      left: { playerId: leftPlayerId, health: -3, maxHealth: 35 },
      right: { playerId: rightPlayerId, health: 24, maxHealth: 47 } } };
  let now = 0; let id = 0; const pending = new Map<number, () => void>();
  const controller = createHealthBarAnimationController({ animateSettledNumbers: true,
    scheduler: { now: () => now, request: (callback) => { pending.set(++id, callback); return id; },
      cancel: (key) => { pending.delete(key); } } });
  syncSessionHealthBarController(controller, source, session);
  return { snapshot, controller, pending,
    view: () => selectSessionHealthBarPresentation(controller.getSnapshot(), source, session, 'mobile')!,
    advance: (ms: number) => { now += ms; const work = [...pending.values()]; pending.clear(); work.forEach((run) => run()); } };
}

describe('mobile live health ownership', () => {
  it.each([
    ['one', 'two', false], ['two', 'one', false], ['one', 'two', true],
  ] as const)('keeps complete upper/lower bundles for %s/%s (spectator: %s)', (leftId, rightId, spectator) => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const playback = liveHealth(leftId, rightId, spectator);
    const names: Record<string, string> = { one: 'Alpha', two: 'Beta' };
    const input = { boardVm: { ...board, turnNumber: 4, myHealth: -3, opponentHealth: 24,
      myLastTurnNet: -25, opponentLastTurnNet: 4 },
      hudVm: { p1Name: names[leftId], p2Name: names[rightId], p1Clock: '1:00', p2Clock: '2:00' },
      leftRailVm: { diceValue: 3, diceAnimateKey: 7 }, thisTurn: presentation,
      mobileDiceModifierSlots: { top: null, bottom: null }, healthDeltaVisible: true,
      topHealthAnchorRef: { current: null }, bottomHealthAnchorRef: { current: null },
      topStatsAnchorRef: { current: null }, bottomStatsAnchorRef: { current: null }, onPopoverToggle: vi.fn(),
    } as unknown as Omit<Parameters<typeof MobileStatusRail>[0], 'healthBarPresentation'>;
    const column = { getBoundingClientRect: () => ({ width: 260 }) };
    const read = () => render(() => MobileStatusRail({ ...input, healthBarPresentation: playback.view() }),
      (tree) => { tree.props.statusColumnRef.current = column; });
    read(); let rail = read();
    expect(rail.props.topRow).toMatchObject({ name: names[rightId], health: 20, maxHealth: 47, netDelta: 4 });
    expect(rail.props.bottomRow).toMatchObject({ name: names[leftId], health: 22, maxHealth: 35, netDelta: -25 });
    expect(rail.props.showDeltas).toBe(false);
    expect(rail.props.topClock).toBe('2:00'); expect(rail.props.bottomClock).toBe('1:00');
    const bars = elements(rail.props.healthBars).filter((node) => node.type === HealthBar);
    const legend = elements(rail.props.healthBars).find((node) => node.type === HealthBarLegend)!;
    expect(bars.map((bar) => bar.props.side)).toEqual(['right', 'left']);
    expect(bars.map((bar) => bar.props.mobileMarkerEdge)).toEqual(['top', 'bottom']);
    expect(bars.map((bar) => bar.props.label)).toEqual([`${names[rightId]} health`, `${names[leftId]} health`]);
    for (const node of [...bars, legend]) {
      expect(node.props.scale).toBe(playback.view().scale); expect(node.props.axisLength).toBe(256);
    }
    expect(legend.props.compactMobile).toBe(true);
    expect(legend.props.scale.domainMin).toBe(-15); expect(legend.props.scale.domainMax).toBe(50);
    expect(playback.snapshot.identity.leftPlayerId).toBe(leftId);
    expect(playback.snapshot.left.playerId).toBe(leftId);
    const outcome = { ...prepareHealthBarOutcome(playback.snapshot.identity,
      { isTerminal: true, winnerPlayerId: rightId, resultReason: 'narrow' })!, opacity: 0.5 };
    const finishedRail = render(() => MobileStatusRail({ ...input, healthBarPresentation: { ...playback.view(), outcome } }));
    const finishedBars = elements(finishedRail.props.healthBars).filter((node) => node.type === HealthBar);
    expect(finishedBars.map((bar) => bar.props.outcome.letters)).toEqual(['NV', 'NL']);
    expect(finishedBars.map((bar) => bar.props.outcomeOpacity)).toEqual([0.5, 0.5]);
    expect(rail.props.healthBars.props.className).toContain('pointer-events-none');
    const frame = MobileStatusRailFrame(rail.props);
    const rows = elements(frame).filter((node) => node.props.position === 'top' || node.props.position === 'bottom');
    expect(rows.map((row) => row.props.healthAnchorRef)).toEqual([input.topHealthAnchorRef, input.bottomHealthAnchorRef]);
    expect(rows.map((row) => row.props.statsAnchorRef)).toEqual([input.topStatsAnchorRef, input.bottomStatsAnchorRef]);
    const hiddenHealth = elements(invoke(rows[1])).find((node) => node.type === 'button')!;
    expect(hiddenHealth.props['aria-label']).toContain(`Health 22, maximum 35, change pending`);
    expect(elements(hiddenHealth).find((node) => node.props['aria-hidden'] === true)!.props.className).toContain('min-h-[16px]');
    const duration = playback.controller.getSnapshot().sequence!.durationMs;
    playback.advance(duration);
    rail = read();
    expect(rail.props.showDeltas).toBe(true);
    expect(rail.props.topRow.health).toBe(20); expect(rail.props.bottomRow.health).toBe(22);
    playback.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    rail = read();
    expect(rail.props.bottomRow.health).toBe(Math.round(playback.view().numbers.left));
    expect(playback.view().numbers.left).toBeCloseTo(9.5);
    expect(rail.props.topRow.health).toBe(22);
    const movingBars = elements(rail.props.healthBars).filter((node) => node.type === HealthBar);
    expect(movingBars[1].props.state).toEqual({ health: -3, red: { from: -3, to: 0 } });
    playback.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    rail = read();
    expect(rail.props.topRow.health).toBe(24); expect(rail.props.bottomRow.health).toBe(-3);
    expect(rail.props.topRow.netDelta).toBe(4); expect(rail.props.bottomRow.netDelta).toBe(-25);
    expect(playback.pending.size).toBe(0);
  });

  it('keeps the neutral live footprint separate from the species-selection divider', () => {
    const input = { healthBarPresentation: null, hudVm: {}, boardVm: { ...board, myHealth: 25, opponentHealth: 25 },
      leftRailVm: {}, thisTurn: null, mobileDiceModifierSlots: { top: null, bottom: null } } as unknown as Parameters<typeof MobileStatusRail>[0];
    const rail = MobileStatusRail(input);
    expect(rail.props.healthBars.props.className).toContain('h-[46px]');
    expect(elements(rail.props.healthBars).some((node) => node.type === HealthBar)).toBe(false);
    const species = MobileStatusRailFrame({ topRow: { name: 'A' }, bottomRow: { name: 'B' },
      topClock: '1:00', bottomClock: '1:00', diceValue: 1, diceAnimateKey: 0 } as Parameters<typeof MobileStatusRailFrame>[0]);
    expect(elements(species).some((node) => node.props.className?.includes('bg-gradient-to-r'))).toBe(true);
  });
});

describe('mobile health playback and interaction integration', () => {
  function input(playback: ReturnType<typeof liveHealth>) {
    return {
      gameId: 'g', healthBarPresentation: playback.view(), hudVm: {},
      boardVm: { ...board, turnNumber: 4, myHealth: -3, opponentHealth: 24,
        myVoidFleet: [], opponentVoidFleet: [], myFleet: [], opponentFleet: [], fleetAnim: { my: [], opponent: [] } },
      leftRailVm: { gameCode: 'g', chatMessages: [], turn: 4 }, turnPhasesVm: {}, turnPhasePresentation: {},
      bottomActionRailVm: {}, actionPanelVm: { activePanelId: 'ap.menu.root',
        menu: { phaseKey: 'build.drawing', turnNumber: 4 }, tabs: [] },
      thisTurn: presentation, presentedThisTurnStats: presentation, gameStats: null,
      viewer: props().viewer, missionChallenge: null, winStreak, matchupIntro: null,
      actions: { onReadyToggle: vi.fn(), onActionPanelTabClick: vi.fn() },
    } as unknown as Parameters<typeof MobileGameLayout>[0];
  }
  function globals() {
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  }
  const find = (tree: ReactNode, type: unknown) => elements(tree).find((node) => node.type === type)!;

  it('keeps paired popovers, takeover callbacks and authoritative inputs while the accepted sequence advances', () => {
    globals();
    const playback = liveHealth(); const config = input(playback);
    const sequence = playback.controller.getSnapshot().sequence;
    const element = (left: number, top: number) => ({ getBoundingClientRect: () =>
      ({ left, top, width: 260, height: 42, right: left + 260, bottom: top + 42 }) });
    const read = () => render(() => MobileGameLayout({ ...config, healthBarPresentation: playback.view() }), (tree) => {
      const boardView = find(tree, MobileBoardView);
      boardView.props.boardRef.current = element(0, 0);
      boardView.props.topRowRef.current = element(14, 250);
      boardView.props.bottomRowRef.current = element(14, 334);
    });
    read(); let tree = read();
    const boardView = find(tree, MobileBoardView);
    // The actual board forwards this presentation and every explicit anchor unchanged.
    const rail = find(MobileBoardView(boardView.props), MobileStatusRail);
    expect(rail.props.healthBarPresentation).toBe(boardView.props.healthBarPresentation);
    expect(rail.props.topHealthAnchorRef).toBe(boardView.props.topHealthAnchorRef);
    expect(rail.props.bottomStatsAnchorRef).toBe(boardView.props.bottomStatsAnchorRef);
    boardView.props.onPopoverToggle(); tree = read();
    const popovers = find(tree, MobileStatBreakdownPopovers);
    expect(popovers.props.boardVm).toBe(config.boardVm);
    expect(popovers.props.thisTurn).toBe(config.presentedThisTurnStats);
    expect(popovers.props.topAnchorRect.top).toBe(250);
    expect(popovers.props.bottomAnchorRect.top).toBe(334);
    popovers.props.onPeriodChange('last'); tree = read();
    expect(find(tree, MobileStatBreakdownPopovers).props.period).toBe('last');
    const damage = sequence!.stages.find((stage) => stage.name === 'damage')!;
    playback.advance(damage.startMs + damage.durationMs / 2); tree = read();
    const frame = playback.controller.getSnapshot().frame;
    for (const [callback, takeover] of [['onOpenChat', 'chat'], ['onOpenBattleLog', 'battleLog'], ['onOpenMenu', 'menu']] as const) {
      find(tree, MobileTopNav).props[callback](); tree = read();
      expect(find(tree, MobileTopNav).props.activeTakeover).toBe(takeover);
      expect(find(tree, MobileStatBreakdownPopovers)).toBeUndefined();
      expect(find(tree, MobileBoardView).props.healthBarPresentation.sequence).toBe(sequence);
      expect(playback.controller.getSnapshot().frame).toBe(frame);
      expect(playback.pending.size).toBe(1);
      find(tree, MobileTopNav).props.onReturnToBoard(); tree = read();
      expect(find(tree, MobileTopNav).props.activeTakeover).toBeNull();
    }
    find(tree, MobileBoardView).props.onPopoverToggle(); tree = read();
    expect(find(tree, MobileStatBreakdownPopovers).props.period).toBe('last');
    find(tree, MobileActionPanel).props.actions.onReadyToggle(); tree = read();
    expect(config.actions.onReadyToggle).toHaveBeenCalledOnce();
    expect(find(tree, MobileStatBreakdownPopovers)).toBeUndefined();
    expect(playback.controller.getSnapshot().sequence).toBe(sequence);
    playback.advance(sequence!.durationMs);
    tree = read();
    expect(find(tree, MobileBoardView).props.healthBarPresentation.delta.visible).toBe(true);
    playback.controller.dispose();
  });

  it('defers mobile finished-panel fallback through the number tail and keeps Missions manual', () => {
    globals();
    const playback = liveHealth('one', 'two', false, true); const config = input(playback);
    config.actionPanelVm = { ...config.actionPanelVm, endOfGame: {
      bannerText: 'Game Over', bannerBgCssVar: 'var(--shapeships-grey-50)',
      metaLeftText: '', metaRightText: '', rematchHelperText: '',
    } };
    config.missionChallenge = { mission: { id: 'm' }, isFinished: true, introPending: false,
      shouldPresentInitialIntro: false, result: { missionSucceeded: true, fleetConditionMet: true, challengeSucceeded: true },
    } as Parameters<typeof MobileGameLayout>[0]['missionChallenge'];
    const read = () => render(() => MobileGameLayout({ ...config, healthBarPresentation: playback.view() }));
    read(); let tree = read();
    expect(find(tree, MobileTopNav).props.isGameOver).toBe(true);
    expect(find(tree, MobileActionPanel).props.terminalHealthBarPresentationPending).toBe(true);
    expect(find(MobileActionPanel(find(tree, MobileActionPanel).props), MobileEndOfGameActionPanel)).toBeUndefined();
    expect(find(tree, MissionChallengeOverlay)).toBeUndefined();
    const sequence = playback.controller.getSnapshot().sequence!;
    playback.advance(sequence.durationMs); tree = read();
    expect(playback.view().delta?.visible).toBe(true);
    expect(find(tree, MobileActionPanel).props.terminalHealthBarPresentationPending).toBe(true);
    playback.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2); tree = read();
    expect(find(tree, MobileActionPanel).props.terminalHealthBarPresentationPending).toBe(true);
    expect(find(MobileActionPanel(find(tree, MobileActionPanel).props), MobileEndOfGameActionPanel)).toBeUndefined();
    playback.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2); tree = read();
    expect(find(tree, MobileActionPanel).props.terminalHealthBarPresentationPending).toBe(false);
    expect(find(MobileActionPanel(find(tree, MobileActionPanel).props), MobileEndOfGameActionPanel)).toBeDefined();
    expect(find(tree, MissionChallengeOverlay)).toBeUndefined();
    find(tree, MobileTopNav).props.onOpenMenu(); tree = read();
    const menu = find(tree, MobileEndOfGameMenuTakeover);
    expect(menu.props.showChallengeAction).toBe(true);
    expect(find(tree, MissionChallengeOverlay)).toBeUndefined();
    menu.props.onOpenChallenge(); tree = read();
    expect(find(tree, MissionChallengeOverlay).props.mode).toBe('result');
    find(tree, MobileTopNav).props.onReturnToBoard(); tree = read();
    expect(find(tree, MissionChallengeOverlay)).toBeUndefined();
    expect(playback.controller.getSnapshot().sequence).toBe(sequence);
    expect(playback.pending.size).toBe(0);
  });
});

describe('paired mobile inspection', () => {
  it('keeps economy identical across tabs, including Fleet, joining, even-zero and streak explanations', () => {
    const economy = (period: 'current' | 'last') => frames(props({ period })).map((frame) => {
      const content = invoke(frame.props.children);
      const grid = Children.toArray(content.props.children)[0] as Element;
      return renderToStaticMarkup(grid);
    });
    const current = economy('current');
    expect(economy('last')).toEqual(current);
    expect(current[0]).toContain('Fleet Value');
    expect(current[0]).toContain('>54<');
    expect(current[1]).toContain('>42<');
    expect(current[0]).toContain('Saved joining lines');
    expect(current[0]).toContain('Joining lines');
    expect(current[0]).toContain('Lines on even turns');
    expect(current[0]).toContain('Computer opponent gains 4 bonus lines');
    expect(current[0]).not.toContain('>Win streak<');
    expect(current[0]).toContain('var(--shapeships-pastel-purple)');
  });

  it('omits unavailable Fleet values, but renders an available zero', () => {
    const render = (boardVm: typeof board) => renderToStaticMarkup(createElement(MobileStatBreakdownPopovers, props({ boardVm })));
    expect(render({ ...board, presentedFleetValue: undefined })).not.toContain('Fleet Value');
    expect(render({ ...board, presentedFleetValue: { my: 0, opponent: 0 } })).toContain('Fleet Value');
  });

  it('renders contribution ownership, one formatted total and simplified estimate wording', () => {
    const cards = frames().map((frame) => renderToStaticMarkup(frame.props.children));
    expect(cards[0].indexOf('Your Damage')).toBeLessThan(cards[0].indexOf('Opponent Healing'));
    expect(cards[1].indexOf('Opponent Damage')).toBeLessThan(cards[1].indexOf('Your Healing'));
    expect(cards[0]).toContain('THIS TURN (ESTIMATE)');
    expect(cards[0].match(/~13\?/g)).toHaveLength(1);
    expect(cards.join('')).not.toMatch(/AUTOCAST|TOTAL|Health Change/);
    const historical = renderToStaticMarkup(createElement(MobileStatBreakdownPopovers, props({ period: 'last' })));
    expect(historical).toContain('Previous source');
    expect(historical).not.toContain('Current source');
  });

  it('preserves spectator labels and reveals an available column beside a concealed column', () => {
    const input = props();
    input.viewer = { ...input.viewer, isSpectator: true, isPlayerViewer: false };
    input.thisTurn = {
      ...presentation,
      opponent: { ...presentation.opponent, healing: { ...presentation.opponent.healing, current: { state: 'concealed', turnNumber: 4 } } },
    };
    const cards = frames(input).map((frame) => renderToStaticMarkup(frame.props.children));
    expect(cards[0]).toContain('Alpha Damage');
    expect(cards[0]).toContain('Beta Healing');
    expect(cards[0]).toContain('Concealed');
    expect(cards[0]).toContain('~13?');
    expect(cards[1]).toContain('Beta Damage');
    expect(cards[1]).toContain('Alpha Healing');
  });

  it('updates both selected indicators from either card and contains tab events', () => {
    let period: 'current' | 'last' = 'current';
    const input = props({ onPeriodChange: (next) => { period = next; } });
    for (const cardIndex of [0, 1]) {
      const card = invoke(frames({ ...input, period })[cardIndex].props.children);
      const tabs = elements(card).filter((element) => element.type === 'button');
      const event = pointer(100, 100);
      tabs[0].props.onPointerDown(event);
      tabs[0].props.onPointerUp(event);
      tabs[0].props.onClick(event);
      expect(event.stopPropagation).toHaveBeenCalledTimes(3);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(input.onDismiss).not.toHaveBeenCalled();
      for (const frame of frames({ ...input, period })) {
        const selected = elements(invoke(frame.props.children)).filter((element) => element.props['aria-pressed'] === true);
        expect(selected).toHaveLength(1);
        expect(selected[0].props.children).toBe('LAST TURN');
      }
      tabs[1].props.onClick(pointer(100, 100));
      expect(period).toBe('current');
    }
  });

  it('dismisses ordinary content taps while retaining drag, cancellation and pointer identity checks', () => {
    const input = props();
    const frame = invoke(frames(input)[0]);
    frame.props.onPointerDown(pointer(100, 100));
    frame.props.onPointerUp(pointer(100, 108));
    expect(input.onDismiss).toHaveBeenCalledTimes(1);
    frame.props.onPointerDown(pointer(100, 100));
    frame.props.onPointerUp(pointer(100, 109));
    frame.props.onPointerDown(pointer(100, 100));
    frame.props.onPointerCancel();
    frame.props.onPointerUp(pointer(100, 100));
    frame.props.onPointerDown(pointer(100, 100));
    frame.props.onPointerUp(pointer(100, 100, 2));
    frame.props.onPointerDown(pointer(100, 100, 1, false));
    frame.props.onPointerUp(pointer(100, 100, 1, false));
    expect(input.onDismiss).toHaveBeenCalledTimes(1);
    expect(frame.props.className).toContain('touch-pan-y');
  });

  it('places both tails at the board centre with stable row-based vertical anchors', () => {
    const input = props({ boardCenterX: 190 });
    const pair = frames(input).map(invoke);
    expect(pair[0].props.style).toMatchObject({ left: 16, width: 328, top: 240, transform: 'translateY(-100%)' });
    expect(pair[1].props.style).toMatchObject({ left: 16, width: 328, top: 386 });
    for (const frame of pair) {
      const tail = elements(frame).find((element) => String(element.props['aria-hidden']) === 'true');
      expect(tail?.props.style.left + frame.props.style.left + 6).toBe(190);
    }
  });

  it('enables all four health/stat buttons with one action and shared expanded state', () => {
    const toggle = vi.fn();
    const row = { name: 'Alpha', statusText: 'Ready', statusTone: 'ready' as const, isOnline: true, health: 99 };
    const input = {
      topRow: row, bottomRow: { ...row, name: 'Beta' }, topClock: '10:04', bottomClock: '10:04',
      diceValue: 3 as const, diceAnimateKey: 0, onPopoverToggle: toggle,
    };
    for (const expanded of [false, true]) {
      const frame = MobileStatusRailFrame({ ...input, popoverExpanded: expanded });
      const rows = elements(frame).filter((element) => element.props.position === 'top' || element.props.position === 'bottom');
      const buttons = rows.flatMap((element) => elements(invoke(element))).filter((element) => element.type === 'button');
      expect(buttons).toHaveLength(4);
      for (const button of buttons) {
        expect(button.props.disabled).toBe(false);
        expect(button.props['aria-expanded']).toBe(expanded);
        expect(button.props.onClick).toBe(toggle);
        button.props.onClick();
      }
      expect(frame.props.onClick).toBeUndefined();
    }
    expect(toggle).toHaveBeenCalledTimes(8);
  });
});
