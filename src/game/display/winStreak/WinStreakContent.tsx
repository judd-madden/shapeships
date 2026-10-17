import type { WinStreakGameViewModel, WinStreakMenuViewModel } from '../../client/winStreak/types';
import { GameMenuButton } from '../../../components/ui/primitives/buttons/GameMenuButton';
import {
  WIN_STREAK_DISCORD_URL,
  getWinStreakBonusCopy,
  shouldShowWinStreakContent,
  shouldUseNextGameBonusCopy,
} from './winStreakPresentation';

export function WinStreakPanelContent({
  vm,
  canReset,
  onReset,
  onRetryRecovery,
  className = '',
}: {
  vm: WinStreakGameViewModel;
  canReset: boolean;
  onReset: () => void | Promise<void>;
  onRetryRecovery?: () => void | Promise<void>;
  className?: string;
}) {
  if (!shouldShowWinStreakContent(vm)) return null;

  const ended = vm.streakState === 'ended';
  const bonusCount = shouldUseNextGameBonusCopy(vm) ? vm.displayCount : vm.appliedBonus.count;

  return (
    <section className={`flex min-w-0 flex-col items-start ${className}`}>
      <div className="flex max-w-full items-center gap-[4px] text-left text-[var(--shapeships-pastel-green)]">
        <span className="shrink-0 text-[40px] sm:text-[50px] font-black leading-none">{vm.displayCount}</span>
        <h2 className="min-w-0 text-[18px] sm:text-[22px] font-black leading-[22px]">
          {ended ? 'WIN STREAK ENDED' : 'WIN STREAK'}
        </h2>
      </div>

      <p className="mt-[4px] text-[16px] font-medium leading-[20px] text-white">
        {ended ? 'Well done!' : getWinStreakBonusCopy(bonusCount, shouldUseNextGameBonusCopy(vm))}
      </p>

      {ended ? (
        <a
          href={WIN_STREAK_DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-[12px] sm:mt-[32px] flex min-h-[36px] max-w-full items-center justify-center rounded-[10px] bg-[var(--shapeships-grey-20)] px-[20px] py-[9px] text-[14px] font-normal leading-normal text-black transition-colors hover:bg-white"
        >
          Join Discord to Share
        </a>
      ) : (
        <>
          <GameMenuButton
            size="compact"
            className="mt-[12px] sm:mt-[32px]"
            disabled={!canReset}
            requiresConfirm
            confirmLabel="Reset Win Streak (Confirm)"
            onClick={onReset}
          >
            Reset Win Streak
          </GameMenuButton>
          {vm.reset.error ? (
            <p className="mt-[10px] text-[14px] leading-[18px] text-[var(--shapeships-pastel-red)]">
              The previous reset needs recovery before another action can be submitted.
            </p>
          ) : null}
          {vm.reset.retryAvailable && onRetryRecovery ? (
            <GameMenuButton
              size="compact"
              className="mt-[10px]"
              disabled={vm.reset.busy}
              pendingLabel="RECOVERING..."
              onClick={onRetryRecovery}
            >
              Retry Recovery
            </GameMenuButton>
          ) : null}
        </>
      )}
    </section>
  );
}

export function WinStreakFinishedGameContent({
  vm,
  className = '',
}: {
  vm: WinStreakGameViewModel;
  className?: string;
}) {
  if (!shouldShowWinStreakContent(vm)) return null;

  const ended = vm.streakState === 'ended';
  const useNextGameCopy = shouldUseNextGameBonusCopy(vm);
  const bonusCount = useNextGameCopy ? vm.displayCount : vm.appliedBonus.count;

  return (
    <section className={`flex min-w-0 flex-col items-stretch ${className}`}>
      <div className="flex min-w-0 items-center justify-between gap-[12px]">
        <h2 className="min-w-0 text-left text-[20px] font-black leading-[22px] text-[var(--shapeships-pastel-green)]">
          {vm.displayCount} {ended ? 'WIN STREAK ENDED' : 'WIN STREAK'}
        </h2>
      </div>

      <p className="mt-[8px] text-[16px] font-medium leading-[20px] text-white">
        {ended ? 'Well done!' : getWinStreakBonusCopy(bonusCount, useNextGameCopy)}
      </p>

      {ended ? (
        <a
          href={WIN_STREAK_DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-[20px] sm:mt-[32px] flex min-h-[36px] max-w-full self-start items-center justify-center rounded-[10px] bg-[var(--shapeships-grey-20)] px-[20px] py-[9px] text-[14px] font-normal leading-normal text-black transition-colors hover:bg-white"
        >
          Join Discord to Share
        </a>
      ) : null}
    </section>
  );
}

export function WinStreakBadge({ vm }: { vm: WinStreakMenuViewModel }) {
  if (!shouldShowWinStreakContent(vm)) return null;

  return (
    <div className="flex items-center gap-[4px] rounded-[10px] text-[var(--shapeships-pastel-green)]">
      <span className="shrink-0 text-[30px] sm:text-[40px] font-black leading-none">{vm.displayCount}</span>
      <span className="text-[16px] sm:text-[20px] font-black leading-[22px]">
        {vm.streakState === 'ended' ? 'WIN STREAK ENDED' : 'WIN STREAK'}
      </span>
    </div>
  );
}
