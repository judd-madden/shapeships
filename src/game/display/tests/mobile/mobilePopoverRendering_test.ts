import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BoardViewModel, ThisTurnMetricVm, ThisTurnPresentationVm } from '../../../client/gameSession/types';
import { MobileStatBreakdownPopovers } from '../../mobile/MobileStatBreakdownPopovers';
import { MobileStatusRailFrame } from '../../mobile/MobileStatusRail';
import type { WinStreakGameViewModel } from '../../../client/winStreak/types';

// Exercise the actual returned event handlers without adding a browser/test-renderer dependency.
// Lifecycle transitions are covered separately by the period-selection tests.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: (current: unknown) => ({ current }),
    useState: (initial: unknown) => [initial, vi.fn()],
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
  };
});

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
