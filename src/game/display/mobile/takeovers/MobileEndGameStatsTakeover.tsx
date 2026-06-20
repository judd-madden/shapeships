import { GameMenuButton } from '../../../../components/ui/primitives';
import { GameStatsOverlayShell } from '../../stats/GameStatsOverlayShell';

interface MobileEndGameStatsTakeoverProps {
  turnCount: number;
  onCloseStats: () => void;
}

export function MobileEndGameStatsTakeover({
  turnCount,
  onCloseStats,
}: MobileEndGameStatsTakeoverProps) {
  return (
    <section
      aria-label="Mobile game stats"
      className="flex min-h-0 flex-1 flex-col px-[16px] pb-[16px]"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-[16px]">
        <div className="min-h-0 w-full flex-1">
          <GameStatsOverlayShell turnCount={turnCount} variant="mobile" />
        </div>

        <div className="flex shrink-0 justify-center">
          <GameMenuButton
            className="h-[54px] w-[260px] max-w-full"
            onClick={onCloseStats}
          >
            Menu
          </GameMenuButton>
        </div>
      </div>
    </section>
  );
}
