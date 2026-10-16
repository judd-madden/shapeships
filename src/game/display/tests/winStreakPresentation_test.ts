declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

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
  assert(getInGameWinStreakResetAction({ onResignGame: resign }) === resign);
  assert(getMenuWinStreakResetAction({ onResetWinStreak: localReset }) === localReset);
});

Deno.test('left rail selects restored two-tab spacing only when XW is absent', () => {
  assert(getWinStreakTabLayout(false) === 'two-tab');
  assert(getWinStreakTabLayout(true) === 'three-tab');
});
