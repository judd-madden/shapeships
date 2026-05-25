import type React from 'react';
import type { LeftRailViewModel } from '../../client/useGameSession';
import { BattleLogTurnCard } from '../layout/leftRail/BattleLogTurnCard';
import { LeftRailScrollArea } from '../layout/leftRail/LeftRailScrollArea';

interface BattleLogPanelContentProps {
  battleLogNames: LeftRailViewModel['battleLogNames'];
  battleLogTurns: LeftRailViewModel['battleLogTurns'];
  battleLogAutoScrollKey: LeftRailViewModel['battleLogAutoScrollKey'];
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
  battleLogAutoScrollKey,
  layout = 'desktop',
  viewportRef,
  headerAction,
  showPanelTitle = true,
}: BattleLogPanelContentProps) {
  const isMobile = layout === 'mobile';

  return (
    <div className="flex h-full min-h-0 flex-col bg-black">
      <div
        className={cx(
          'shrink-0 bg-black border-b border-[var(--shapeships-grey-70)] px-[20px] py-[12px] flex flex-col gap-[8px]',
          isMobile ? undefined : 'rounded-t-[10px]'
        )}
      >
        <div className="flex items-center justify-between">
          {showPanelTitle ? (
            <p className="text-white text-[18px] font-black">Battle Log</p>
          ) : (
            <div aria-hidden="true" />
          )}
          {headerAction}
        </div>
        <div className="grid grid-cols-2 gap-[20px] text-[15px] leading-none text-[var(--shapeships-grey-20)]">
          <p className="text-left font-bold">{battleLogNames.me}</p>
          <p className="text-right font-bold">{battleLogNames.opponent}</p>
        </div>
      </div>

      <LeftRailScrollArea
        viewportRef={viewportRef}
        outerClassName={cx('basis-0 flex-1 pb-3', isMobile ? 'rounded-b-[10px]' : 'rounded-b-[10px]')}
        forceScrollOnChangeKey={battleLogAutoScrollKey}
      >
        {battleLogTurns.length > 0 ? (
          battleLogTurns.map((turn) => <BattleLogTurnCard key={turn.turnNumber} turn={turn} />)
        ) : (
          <p className="px-[20px] py-[14px] text-[15px] leading-[18px] text-[var(--shapeships-grey-50)]">
            No completed turns yet.
          </p>
        )}
      </LeftRailScrollArea>
    </div>
  );
}
