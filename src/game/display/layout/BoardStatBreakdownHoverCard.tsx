import * as ReactDOM from 'react-dom';
import type { BoardStatBreakdownRowVm } from '../../client/gameSession/types';

interface BoardStatBreakdownHoverCardProps {
  anchorRect: DOMRect;
  side: 'left' | 'right';
  rows: BoardStatBreakdownRowVm[];
}

const HOVER_GAP_PX = 8;
const TAIL_SIZE_PX = 12;
const TAIL_PROTRUSION_PX = TAIL_SIZE_PX / 2;

function BreakdownRow({ row }: { row: BoardStatBreakdownRowVm }) {
  return (
    <div className="flex items-center justify-between gap-[12px]">
      {row.rowKind === 'ship' ? (
        <div
          className="min-w-0 flex items-center gap-[4px] text-left text-white"
          style={{ fontSize: '14px', lineHeight: 1.4, fontVariationSettings: "'wdth' 100" }}
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
          style={{ fontSize: '14px', lineHeight: 1.4, fontVariationSettings: "'wdth' 100" }}
        >
          {row.label}
        </div>
      )}

      <div
        className="shrink-0 text-right font-black text-white"
        style={{ fontSize: '14px', lineHeight: 1.4, fontVariationSettings: "'wdth' 100" }}
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
        className="relative flex w-[220px] flex-col gap-[4px] rounded-[10px] bg-[#212121] px-[20px] py-[16px]"
        style={{
          pointerEvents: 'none',
          transform: isLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[10px] border border-solid border-[#555] pointer-events-none"
        />

        <div
          aria-hidden="true"
          className="absolute top-1/2 size-[12px] -translate-y-1/2 rotate-45 border-solid border-[#555] bg-[#212121] pointer-events-none"
          style={
            isLeft
              ? { right: '-6px', borderTopWidth: '1px', borderRightWidth: '1px' }
              : { left: '-6px', borderBottomWidth: '1px', borderLeftWidth: '1px' }
          }
        />

        {rows.map((row, index) => (
          <BreakdownRow
            key={`${row.rowKind}:${row.label}:${row.amount}:${row.count ?? index}`}
            row={row}
          />
        ))}
      </div>
    </div>,
    portalTarget
  );
}
