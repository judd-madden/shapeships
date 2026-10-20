import type { WinStreakGameViewModel } from './types';

export function formatWinStreakBattleLogMessage(
  appliedBonus: WinStreakGameViewModel['appliedBonus'] | null | undefined,
): string | null {
  if (!appliedBonus || appliedBonus.count <= 0 || appliedBonus.recipientSide !== 'opponent') {
    return null;
  }

  const { count } = appliedBonus;
  return `Computer receives +${count} bonus ${count === 1 ? 'line' : 'lines'} on Turn 1 due to your win streak.`;
}
