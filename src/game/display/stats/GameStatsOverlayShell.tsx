import { CloseIcon } from '../../../components/ui/primitives/icons/CloseIcon';
import type { GameStatsViewModel } from '../../client/gameSession/types';
import { GameStatsBoard } from './GameStatsBoard';

interface GameStatsOverlayShellProps {
  gameStats: GameStatsViewModel;
  onClose?: () => void;
  variant?: 'desktop' | 'mobile';
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function GameStatsOverlayShell({
  gameStats,
  onClose,
  variant = 'desktop',
}: GameStatsOverlayShellProps) {
  const isMobile = variant === 'mobile';

  return (
    <section
      aria-label="Game stats"
      className={cx(
        'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-tl-[10px] rounded-tr-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)] text-[var(--shapeships-white)]'
      )}
    >
      <GameStatsBoard
        gameStats={gameStats}
        closeControl={
          !isMobile && onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close game stats"
              className="flex size-[42px] shrink-0 items-center justify-center rounded-[8px] text-[var(--shapeships-white)] opacity-75 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shapeships-white)]"
            >
              <CloseIcon className="!size-[22px]" />
            </button>
          ) : null
        }
      />
    </section>
  );
}
