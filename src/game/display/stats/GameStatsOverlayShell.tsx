import { CloseIcon } from '../../../components/ui/primitives/icons/CloseIcon';

interface GameStatsOverlayShellProps {
  turnCount: number;
  onClose?: () => void;
  variant?: 'desktop' | 'mobile';
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function GameStatsOverlayShell({
  turnCount,
  onClose,
  variant = 'desktop',
}: GameStatsOverlayShellProps) {
  const isMobile = variant === 'mobile';

  return (
    <section
      aria-label="Game stats"
      className={cx(
        'flex min-h-0 w-full h-full flex-col overflow-hidden rounded-tl-[10px] rounded-tr-[10px] border-2 border-[var(--shapeships-grey-70)] bg-black text-white'
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-[16px] border-b border-[var(--shapeships-grey-70)] px-[18px] py-[14px]">
        <div className="min-w-0">
          <p
            className={cx(
              "font-['Roboto'] font-black leading-none text-white",
              isMobile ? 'text-[20px]' : 'text-[24px]'
            )}
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            GAME STATS
          </p>
          <p
            className="mt-[6px] text-[14px] font-normal leading-none text-[var(--shapeships-grey-30)]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
          </p>
        </div>

        {!isMobile && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game stats"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-[8px] text-white opacity-75 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <CloseIcon className="!size-[22px]" />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-[20px] py-[28px] text-center">
        <p
          className="text-[18px] font-bold leading-[1.3] text-[var(--shapeships-grey-30)]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Stats charts will render here.
        </p>
      </div>
    </section>
  );
}
