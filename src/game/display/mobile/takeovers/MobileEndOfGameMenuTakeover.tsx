import type { ActionPanelViewModel, GameSessionViewModel } from '../../../client/useGameSession';
import { GameMenuButton } from '../../../../components/ui/primitives';
import { ChallengeIcon } from '../../../../components/ui/primitives/icons/ChallengeIcon';
import { WinStreakFinishedGameContent } from '../../winStreak/WinStreakContent';
import { shouldShowWinStreakContent } from '../../winStreak/winStreakPresentation';
import { MobileTakeoverShell } from './MobileTakeoverShell';

interface MobileEndOfGameMenuTakeoverProps {
  endOfGame: NonNullable<ActionPanelViewModel['endOfGame']>;
  winStreak: GameSessionViewModel['winStreak'];
  canViewGameStats: boolean;
  showChallengeAction: boolean;
  onOpenChallenge: () => void;
  onOpenGameStats: () => void;
  onClose: () => void;
  onReturnToMainMenu: () => void;
  onRematch: () => void;
  onDownloadBattleLog: () => void;
}

export function MobileEndOfGameMenuTakeover({
  endOfGame,
  winStreak,
  canViewGameStats,
  showChallengeAction,
  onOpenChallenge,
  onOpenGameStats,
  onClose,
  onReturnToMainMenu,
  onRematch,
  onDownloadBattleLog,
}: MobileEndOfGameMenuTakeoverProps) {
  return (
    <MobileTakeoverShell
      title="Game Over"
      onClose={onClose}
      bodyClassName="flex flex-col"
    >
      <div className="flex min-h-full flex-col">
        <div className="flex grow shrink-0 flex-col items-center justify-center px-[16px] py-[20px]">
          <div className="flex w-full flex-col items-center gap-[16px]">
            <div className="flex w-[260px] max-w-full flex-col items-center">
              <GameMenuButton
                className="h-[54px] w-[260px] max-w-full"
                onClick={onRematch}
                pendingLabel="CREATING..."
              >
                New Game
              </GameMenuButton>
              <p
                className="mt-[8px] text-center text-[15px] font-normal leading-[19px] text-white"
              >
                {endOfGame.rematchHelperText}
              </p>
            </div>

            <GameMenuButton
              className="h-[54px] w-[260px] max-w-full"
              onClick={onOpenGameStats}
              disabled={!canViewGameStats}
            >
              View Stats
            </GameMenuButton>

            <GameMenuButton
              className="h-[54px] w-[260px] max-w-full"
              onClick={onDownloadBattleLog}
            >
              Download Battle Log
            </GameMenuButton>

            {showChallengeAction ? (
              <GameMenuButton
                className="h-[54px] w-[260px] max-w-full"
                onClick={onOpenChallenge}
              >
                <span className="flex items-center gap-[10px]">
                  <ChallengeIcon className="h-[28px] w-auto text-black" />
                  <span>Mission</span>
                </span>
              </GameMenuButton>
            ) : null}

            <GameMenuButton
              className="h-[54px] w-[260px] max-w-full"
              onClick={onReturnToMainMenu}
            >
              Return to Main Menu
            </GameMenuButton>
          </div>
        </div>

        {shouldShowWinStreakContent(winStreak) ? (
          <div className="w-full shrink-0 border-t-1 border-[var(--shapeships-grey-70)] bg-black px-[18px] py-[24px]">
            <WinStreakFinishedGameContent vm={winStreak} />
          </div>
        ) : null}

        <div
          className="flex shrink-0 flex-col items-center justify-center px-[18px] py-[24px] text-center text-black"
          style={{ background: endOfGame.bannerBgCssVar }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex h-[50px] w-[260px] max-w-full items-center justify-center rounded-[8px] bg-black px-[24px] text-white transition-opacity active:opacity-80"
          >
            <span
              className="text-[16px] font-black leading-none"
            >
              View Board
            </span>
          </button>
        </div>
      </div>
    </MobileTakeoverShell>
  );
}
