import type React from 'react';
import type { LeftRailViewModel } from '../../client/useGameSession';
import { BattleLogTurnCard } from '../layout/leftRail/BattleLogTurnCard';
import { LeftRailScrollArea } from '../layout/leftRail/LeftRailScrollArea';

interface BattleLogPanelContentProps {
  battleLogNames: LeftRailViewModel['battleLogNames'];
  battleLogTurns: LeftRailViewModel['battleLogTurns'];
  layout?: 'desktop' | 'mobile';
  viewportRef?: React.Ref<HTMLDivElement | null>;
  headerAction?: React.ReactNode;
  showPanelTitle?: boolean;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function BattleLogPanelContent({
  battleLogNames,
  battleLogTurns,
  layout = 'desktop',
  viewportRef,
  headerAction,
  showPanelTitle = true,
}: BattleLogPanelContentProps) {
  const isMobile = layout === 'mobile';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cx(
          'shrink-0 bg-black border-b border-[var(--shapeships-grey-70)] px-[20px] py-[12px] flex flex-col gap-[8px]',
          isMobile ? undefined : 'rounded-t-[10px]'
        )}
      >
        {showPanelTitle || headerAction ? (
          <div className="flex items-center justify-between">
            {showPanelTitle ? (
              <p className="text-white text-[18px] font-black">Battle Log</p>
            ) : (
              <div aria-hidden="true" />
            )}
            {headerAction}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-[20px] text-[15px] leading-none text-[var(--shapeships-grey-20)]">
          <p className="text-left font-bold">{battleLogNames.me}</p>
          <p className="text-right font-bold">{battleLogNames.opponent}</p>
        </div>
      </div>

      <LeftRailScrollArea
        viewportRef={viewportRef}
        outerClassName={cx('basis-0 flex-1 pb-3', isMobile ? 'rounded-b-[10px]' : 'rounded-b-[10px]')}
      >
        {battleLogTurns.length > 0 ? (
          battleLogTurns.map((turn) => <BattleLogTurnCard key={turn.turnNumber} turn={turn} />)
        ) : (
          <p className="px-[20px] py-[24px] text-[16px] leading-[22px] text-[var(--shapeships-grey-50)]">
            The battle is about to begin!<br />May the dice be with you.
          </p>
        )}
      </LeftRailScrollArea>
    </div>
  );
}
