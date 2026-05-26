import type { ActionPanelViewModel } from '../../../client/useGameSession';

interface MobileEndOfGameActionPanelProps {
  endOfGame: NonNullable<ActionPanelViewModel['endOfGame']>;
  onOpenMenu?: () => void;
}

export function MobileEndOfGameActionPanel({
  endOfGame,
  onOpenMenu,
}: MobileEndOfGameActionPanelProps) {
  return (
    <div
      aria-label="Mobile game result"
      className="flex h-[204px] w-full shrink-0 flex-col items-center justify-center gap-[12px] border-t border-[var(--shapeships-grey-70)] px-[18px] py-[16px] text-center text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
      style={{ background: endOfGame.bannerBgCssVar }}
    >
      <div className="flex min-w-0 max-w-full flex-col items-center gap-[5px]">
        <p
          className="max-w-full text-[30px] px-[24px] font-black leading-[32px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {endOfGame.bannerText}
        </p>
        <p
          className="max-w-full text-[15px] font-bold leading-[18px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {endOfGame.metaLeftText} {endOfGame.metaRightText}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-[48px] w-[260px] max-w-full items-center justify-center rounded-[8px] bg-black px-[24px] text-white transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={onOpenMenu == null}
      >
        <span
          className="text-[16px] font-black leading-none"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Menu
        </span>
      </button>
    </div>
  );
}
