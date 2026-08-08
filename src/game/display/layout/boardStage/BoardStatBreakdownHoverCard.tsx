import * as ReactDOM from 'react-dom';
import type { BoardStatBreakdownRowVm } from '../../../client/gameSession/types';
import { HoverPanelFrame } from '../../shared/HoverPanelFrame';
import type { HoverPanelMotionState } from '../../shared/useHoverPanelPresence';

interface BoardStatBreakdownHoverCardProps {
  anchorRect: DOMRect;
  side: 'left' | 'right';
  rows: BoardStatBreakdownRowVm[];
  motionState?: HoverPanelMotionState | null;
}

const HOVER_GAP_PX = 8;
const TAIL_SIZE_PX = 12;
const TAIL_PROTRUSION_PX = TAIL_SIZE_PX / 2;

function BreakdownRow({ row }: { row: BoardStatBreakdownRowVm }) {
  return (
    <div className="flex items-center justify-between gap-[12px]">
      {row.rowKind === 'ship' || row.rowKind === 'solar_power' ? (
        <div
          className="min-w-0 flex items-center gap-[4px] text-left text-white"
          style={{ fontSize: '14px', lineHeight: 1.4 }}
        >
          <span className="font-normal">{row.count ?? 0}</span>
          <span className="font-normal" style={{ color: 'var(--shapeships-grey-50)' }}>
            x
          </span>
          <span className="min-w-0 truncate font-normal">{row.label}</span>
        </div>
      ) : (
        <div
          className="min-w-0 truncate text-left font-normal text-white"
          style={{ fontSize: '14px', lineHeight: 1.4 }}
        >
          {row.label}
        </div>
      )}

      <div
        className="shrink-0 text-right font-black text-white"
        style={{ fontSize: '14px', lineHeight: 1.4 }}
      >
        {row.amountText}
      </div>
    </div>
  );
}

export function BoardStatBreakdownHoverCard({
  anchorRect,
  side,
  rows,
  motionState,
}: BoardStatBreakdownHoverCardProps) {
  if (rows.length === 0) {
    return null;
  }

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  const anchorOffsetX = HOVER_GAP_PX + TAIL_PROTRUSION_PX;
  const anchorX = side === 'left'
    ? anchorRect.left - anchorOffsetX
    : anchorRect.right + anchorOffsetX;
  const anchorY = anchorRect.top + (anchorRect.height / 2);
  const isLeft = side === 'left';

  return ReactDOM.createPortal(
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${anchorX}px`,
        top: `${anchorY}px`,
        width: '0px',
        height: '0px',
      }}
    >
      <div
        className="relative w-[220px]"
        style={{
          transform: isLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
        }}
      >
        <HoverPanelFrame
          placement={isLeft ? 'left' : 'right'}
          motionDirection={isLeft ? 'left' : 'right'}
          motionState={motionState}
          className="flex w-full flex-col gap-[4px] px-[20px] py-[16px]"
        >
          {rows.map((row, index) => (
            <BreakdownRow
              key={`${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? index : index}`}
              row={row}
            />
          ))}
        </HoverPanelFrame>
      </div>
    </div>,
    portalTarget
  );
}
