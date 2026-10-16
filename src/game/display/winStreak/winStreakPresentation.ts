import type { BoardStatBreakdownRowVm } from '../../client/gameSession/types';
import type {
  WinStreakGameViewModel,
  WinStreakMenuViewModel,
} from '../../client/winStreak/types';
import type { GameSessionActions } from '../../client/gameSession/types';
import type { WinStreakMenuActions } from '../../client/winStreak/types';

export const WIN_STREAK_DISCORD_URL = 'https://discord.gg/MjPtf4G6Gt';

export function shouldShowWinStreakContent(
  vm: Pick<WinStreakGameViewModel | WinStreakMenuViewModel, 'shouldShowContent' | 'displayCount'>,
): boolean {
  return vm.shouldShowContent && vm.displayCount > 0;
}

export function getWinStreakBonusCopy(count: number, nextGame = false): string {
  const noun = count === 1 ? 'line' : 'lines';
  return `Computer opponent gains ${count} bonus ${noun} at the start of the ${nextGame ? 'next ' : ''}game.`;
}

export function shouldUseNextGameBonusCopy(vm: WinStreakGameViewModel): boolean {
  return vm.streakState === 'active' && vm.displayCount > vm.appliedBonus.count;
}

export function canSubmitInGameWinStreakReset(
  vm: WinStreakGameViewModel,
  canResign: boolean,
): boolean {
  return shouldShowWinStreakContent(vm) && vm.streakState === 'active' && vm.reset.canSubmit && canResign;
}

export function getInGameWinStreakResetAction(
  actions: Pick<GameSessionActions, 'onResignGame'>,
) {
  return actions.onResignGame;
}

export function getMenuWinStreakResetAction(
  actions: Pick<WinStreakMenuActions, 'onResetWinStreak'>,
) {
  return actions.onResetWinStreak;
}

export function shouldShowWinStreakBonusDetail(vm: WinStreakGameViewModel): boolean {
  return vm.appliedBonus.turnOneHoverEligible &&
    vm.appliedBonus.count > 0 &&
    vm.appliedBonus.recipientSide === 'opponent';
}

export function withoutWinStreakBreakdownRow(
  rows: BoardStatBreakdownRowVm[],
): BoardStatBreakdownRowVm[] {
  return rows.filter((row) => row.label.toLowerCase() !== 'win streak');
}

export type WinStreakSisterView = 'battleLog' | 'turnPhases' | 'winStreak';

export function resolveWinStreakSisterView(
  selected: WinStreakSisterView,
  showWinStreak: boolean,
): WinStreakSisterView {
  return selected === 'winStreak' && !showWinStreak ? 'turnPhases' : selected;
}

export function getWinStreakTabLayout(showWinStreak: boolean): 'two-tab' | 'three-tab' {
  return showWinStreak ? 'three-tab' : 'two-tab';
}
