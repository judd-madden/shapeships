declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { vi } from 'vitest';
import { LeftRail } from '../layout/LeftRail';
import { MobileMenuTakeover } from '../mobile/takeovers/MobileMenuTakeover';
import { MenuActionPanel } from '../actionPanel/panels/MenuActionPanel';
import { GameMenuButton } from '../../../components/ui/primitives/buttons/GameMenuButton';
import { WinStreakPanelContent } from '../winStreak/WinStreakContent';
import type { WinStreakGameViewModel } from '../../client/winStreak/types';
import {
  canSubmitInGameWinStreakReset,
  getInGameWinStreakResetAction,
  getMenuWinStreakResetAction,
  getWinStreakTabLayout,
  getWinStreakBonusCopy,
  resolveWinStreakSisterView,
  shouldShowWinStreakBonusDetail,
  shouldShowWinStreakContent,
  shouldUseNextGameBonusCopy,
  withoutWinStreakBreakdownRow,
} from '../winStreak/winStreakPresentation';

// Inspect real caller elements in Node; effects and child components need no DOM.
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
  useLayoutEffect: () => {},
}));

function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap((child) => isValidElement(child)
    ? [child as ReactElement<any>, ...elements((child as ReactElement<any>).props.children)] : []);
}

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function gameVm(overrides: Partial<WinStreakGameViewModel> = {}): WinStreakGameViewModel {
  return {
    currentCount: 3,
    displayCount: 3,
    streakState: 'active',
    shouldShowContent: true,
    appliedBonus: {
      count: 2,
      recipientPlayerId: 'bot',
      recipientSide: 'opponent',
      turnOneHoverEligible: true,
    },
    reset: {
      serverCanRestart: false,
      canSubmit: true,
      busy: false,
      retryAvailable: false,
      error: null,
    },
    ...overrides,
  };
}

Deno.test('win streak content selects active and ended states while hiding absent content', () => {
  assert(shouldShowWinStreakContent(gameVm({ streakState: 'active' })));
  assert(shouldShowWinStreakContent(gameVm({ streakState: 'ended' })));
  assert(!shouldShowWinStreakContent(gameVm({ displayCount: 0, shouldShowContent: true })));
  assert(!shouldShowWinStreakContent(gameVm({ displayCount: 4, shouldShowContent: false })));
  assert(resolveWinStreakSisterView('winStreak', false) === 'turnPhases');
  assert(resolveWinStreakSisterView('battleLog', false) === 'battleLog');
});

Deno.test('bonus copy pluralizes and distinguishes the completed-win next game', () => {
  assert(getWinStreakBonusCopy(1) === 'Computer opponent gains 1 bonus line at the start of the game.');
  assert(getWinStreakBonusCopy(3, true) === 'Computer opponent gains 3 bonus lines at the start of the next game.');
  assert(shouldUseNextGameBonusCopy(gameVm({ displayCount: 3, appliedBonus: { count: 2, recipientPlayerId: 'bot', recipientSide: 'opponent', turnOneHoverEligible: false } })));
  assert(!shouldUseNextGameBonusCopy(gameVm({ streakState: 'ended', displayCount: 3, appliedBonus: { count: 2, recipientPlayerId: 'bot', recipientSide: 'opponent', turnOneHoverEligible: false } })));
  assert(!shouldUseNextGameBonusCopy(gameVm({ displayCount: 2, appliedBonus: { count: 2, recipientPlayerId: 'bot', recipientSide: 'opponent', turnOneHoverEligible: false } })));
});

Deno.test('streak bonus detail uses fixed opponent bonus and preserves ordinary rows', () => {
  const vm = gameVm({ currentCount: 8, displayCount: 8 });
  assert(shouldShowWinStreakBonusDetail(vm));
  assert(!shouldShowWinStreakBonusDetail(gameVm({ appliedBonus: { ...vm.appliedBonus, recipientSide: 'viewer' } })));
  assert(!shouldShowWinStreakBonusDetail(gameVm({ appliedBonus: { ...vm.appliedBonus, turnOneHoverEligible: false } })));
  const rows = withoutWinStreakBreakdownRow([
    { rowKind: 'adjustment', label: 'Win Streak', amount: 2, amountText: '+2' },
    { rowKind: 'ship', label: 'Defender', count: 1, amount: 1, amountText: '+1' },
  ]);
  assert(rows.length === 1 && rows[0]?.label === 'Defender');
});

Deno.test('in-game eligibility requires canResign and reset actions remain distinct', () => {
  assert(canSubmitInGameWinStreakReset(gameVm(), true));
  assert(!canSubmitInGameWinStreakReset(gameVm(), false));
  assert(!canSubmitInGameWinStreakReset(gameVm({ reset: { ...gameVm().reset, canSubmit: false } }), true));

  const resign = () => undefined;
  const localReset = async () => undefined;
  const inGameReset = async () => undefined;
  const actions = { onResignGame: resign, onResetWinStreak: inGameReset };
  assert(getInGameWinStreakResetAction(actions) === inGameReset);
  assert(getMenuWinStreakResetAction({ onResetWinStreak: localReset }) === localReset);
});

Deno.test('left rail selects restored two-tab spacing only when XW is absent', () => {
  assert(getWinStreakTabLayout(false) === 'two-tab');
  assert(getWinStreakTabLayout(true) === 'three-tab');
});

Deno.test('desktop and mobile callers bind Reset to the shared reset action and preserve ordinary Resign', async () => {
  const reset = vi.fn(async () => {});
  const resign = vi.fn(() => {});
  const retry = vi.fn(async () => {});
  const actions = { onResetWinStreak: reset, onResignGame: resign, onRetryWinStreakReset: retry };
  const desktop = LeftRail({
    vm: {}, turnPhases: {}, turnPhasePresentation: {}, actions,
    winStreak: gameVm(), canResign: true, isFinished: false, isPlayerViewer: true,
  } as unknown as ComponentProps<typeof LeftRail>);
  const mobile = MobileMenuTakeover({
    vm: { canResign: true }, actions, winStreak: gameVm(),
  } as unknown as ComponentProps<typeof MobileMenuTakeover>);

  for (const tree of [desktop, mobile]) {
    const panel = elements(tree).find((element) => element.type === WinStreakPanelContent);
    assert(panel?.props.canReset === true);
    assert(panel.props.onReset === reset);
    assert(panel.props.onRetryRecovery === retry);
    await panel.props.onReset();
  }
  assert(reset.mock.calls.length === 2);
  assert(resign.mock.calls.length === 0);

  const desktopMenu = MenuActionPanel({ canResign: true, onResignGame: resign } as unknown as ComponentProps<typeof MenuActionPanel>);
  for (const tree of [desktopMenu, mobile]) {
    const button = elements(tree).find((element) =>
      element.type === GameMenuButton && element.props.confirmLabel === 'Resign Game (Confirm)');
    assert(button?.props.onClick === resign);
  }
});
