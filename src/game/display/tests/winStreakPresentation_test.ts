declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import type { WinStreakGameViewModel } from '../../client/winStreak/types';
import {
  canSubmitInGameWinStreakReset,
  getInGameWinStreakResetAction,
  getMenuWinStreakResetAction,
  getWinStreakWorkflowControls,
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
    creation: {
      status: 'idle',
      busy: false,
      error: null,
      recoveryGameId: null,
      requiresExplicitRelease: false,
    },
    unfinishedGame: {
      status: 'none',
      gameId: null,
      rejoinUrl: null,
      canRejoin: false,
      canConfirmAbandonment: false,
      error: null,
    },
    ...overrides,
  };
}

Deno.test('win streak content hides zero and falls back from a disappearing tab', () => {
  assert(!shouldShowWinStreakContent(gameVm({ displayCount: 0, shouldShowContent: true })));
  assert(!shouldShowWinStreakContent(gameVm({ displayCount: 4, shouldShowContent: false })));
  assert(resolveWinStreakSisterView('winStreak', false) === 'turnPhases');
  assert(resolveWinStreakSisterView('battleLog', false) === 'battleLog');
});

Deno.test('bonus copy pluralizes and distinguishes the completed-win next game', () => {
  assert(getWinStreakBonusCopy(1) === 'Computer opponent gains 1 bonus line at the start of the game.');
  assert(getWinStreakBonusCopy(3, true) === 'Computer opponent gains 3 bonus lines at the start of the next game.');
  assert(shouldUseNextGameBonusCopy(gameVm({ displayCount: 3, appliedBonus: { count: 2, recipientPlayerId: 'bot', recipientSide: 'opponent', turnOneHoverEligible: false } })));
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

Deno.test('workflow controls expose confirmation, recovery, retry, and deliberate release', () => {
  const vm = gameVm();
  const confirmation = getWinStreakWorkflowControls(vm.creation, {
    ...vm.unfinishedGame,
    status: 'confirmation_required',
    gameId: 'GAME-1',
    canRejoin: true,
    canConfirmAbandonment: true,
  });
  assert(confirmation.showConfirm && confirmation.showRejoin);

  const recovery = getWinStreakWorkflowControls({
    ...vm.creation,
    status: 'stale_success',
    recoveryGameId: 'GAME-2',
    requiresExplicitRelease: true,
  }, vm.unfinishedGame);
  assert(recovery.showRecovered && recovery.showRelease);

  const retry = getWinStreakWorkflowControls({ ...vm.creation, status: 'error' }, vm.unfinishedGame);
  assert(retry.showRetry);
});
