/**
 * End of Game Action Panel
 * Shown when vm.activePanelId === 'ap.end_of_game.result'
 * Displays game result banner and post-game action buttons
 */

import { GameMenuButton } from '../../../../components/ui/primitives/buttons/GameMenuButton';

interface EndOfGameActionPanelProps {
  bannerText: string;       // headline (already composed in VM)
  bannerBgCssVar: string;   // e.g. "var(--shapeships-pastel-blue)"
  metaLeftText: string;     // "Game Over. 18 turns."
  metaRightText: string;    // "Shapeships Game: {me} v {opponent}"
  onReturnToMainMenu: () => void;
  onRematch: () => void;
  onDownloadBattleLog: () => void;
}

export function EndOfGameActionPanel({
  bannerText,
  bannerBgCssVar,
  metaLeftText,
  metaRightText,
  onReturnToMainMenu,
  onRematch,
  onDownloadBattleLog,
}: EndOfGameActionPanelProps) {
  return (
    <div className="flex-row items-center w-full h-[280px]">
      {/* Top Banner */}
      <div 
        className="content-stretch flex flex-col font-bold gap-[12px] h-[150px] items-center justify-center px-[20px] py-[27px] rounded-tl-[10px] rounded-tr-[10px] text-black w-full"
        style={{ background: bannerBgCssVar }}
      >
        {/* Headline */}
        <p 
          className="leading-[normal] relative shrink-0 text-[50px] text-center"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {bannerText}
        </p>

        {/* Meta Row */}
        <div className="content-stretch flex gap-[24px] items-center relative shrink-0 text-[18px]">
          <p 
            className="leading-[normal] relative shrink-0 text-center"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {metaLeftText}
          </p>
          <p 
            className="leading-[normal] relative shrink-0 text-center"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {metaRightText}
          </p>
        </div>
      </div>

      {/* Buttons (centered below banner) */}
      <div className="content-stretch flex items-center w-full pt-[40px]">
        <div className="content-stretch flex gap-[20px] items-center justify-center w-full">
          <GameMenuButton onClick={onReturnToMainMenu}>
            Return to Main Menu
          </GameMenuButton>

          <GameMenuButton onClick={onRematch}>
            Rematch
          </GameMenuButton>

          <GameMenuButton onClick={onDownloadBattleLog}>
            Download Battle Log
          </GameMenuButton>
        </div>
      </div>
    </div>
  );
}
