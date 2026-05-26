import type { ActionPanelViewModel } from '../../../client/useGameSession';
import { GameMenuButton } from '../../../../components/ui/primitives';
import { MobileTakeoverShell } from './MobileTakeoverShell';

interface MobileEndOfGameMenuTakeoverProps {
  endOfGame: NonNullable<ActionPanelViewModel['endOfGame']>;
  onClose: () => void;
  onReturnToMainMenu: () => void;
  onRematch: () => void;
  onDownloadBattleLog: () => void;
}

export function MobileEndOfGameMenuTakeover({
  endOfGame,
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
        <div className="flex grow shrink-0 flex-col items-center justify-center px-[16px] py-[28px]">
          <div className="flex w-full flex-col items-center gap-[32px]">
            <GameMenuButton
              className="h-[54px] w-[260px] max-w-full"
              onClick={onReturnToMainMenu}
            >
              Return to Main Menu
            </GameMenuButton>

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
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Link will be posted in chat
              </p>
            </div>

            <GameMenuButton
              className="h-[54px] w-[260px] max-w-full"
              onClick={onDownloadBattleLog}
            >
              Download Battle Log
            </GameMenuButton>
          </div>
        </div>

        <div
          className="flex grow shrink-0 flex-col items-center justify-center gap-[14px] px-[18px] py-[24px] text-center text-black"
          style={{ background: endOfGame.bannerBgCssVar }}
        >
          <div className="flex min-w-0 max-w-full flex-col items-center gap-[7px]">
            <p
              className="max-w-full text-[32px] font-black leading-[34px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {endOfGame.bannerText}
            </p>
            <p
              className="max-w-full text-[16px] font-bold leading-[20px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {endOfGame.metaLeftText} {endOfGame.metaRightText}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[50px] w-[260px] max-w-full items-center justify-center rounded-[8px] bg-black px-[24px] text-white transition-opacity active:opacity-80"
          >
            <span
              className="text-[16px] font-black leading-none"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              View Board
            </span>
          </button>
        </div>
      </div>
    </MobileTakeoverShell>
  );
}
