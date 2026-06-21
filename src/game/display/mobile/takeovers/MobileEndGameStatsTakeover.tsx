import { GameMenuButton } from '../../../../components/ui/primitives';
import type { GameStatsViewModel } from '../../../client/gameSession/types';
import { GameStatsOverlayShell } from '../../stats/GameStatsOverlayShell';

interface MobileEndGameStatsTakeoverProps {
  gameStats: GameStatsViewModel;
  onCloseStats: () => void;
}

export function MobileEndGameStatsTakeover({
  gameStats,
  onCloseStats,
}: MobileEndGameStatsTakeoverProps) {
  return (
    <section
      aria-label="Mobile game stats"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[16px] pb-[16px]"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-[16px] overflow-hidden">
        <div className="min-h-0 min-w-0 w-full flex-1 overflow-hidden">
          <GameStatsOverlayShell gameStats={gameStats} variant="mobile" />
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
