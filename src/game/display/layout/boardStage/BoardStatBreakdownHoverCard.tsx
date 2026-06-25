import * as ReactDOM from 'react-dom';
import type { BoardStatBreakdownRowVm } from '../../../client/gameSession/types';
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
  const hasMotion = motionState != null;

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
        <div
          className={`relative flex w-full flex-col gap-[4px] rounded-[10px] bg-[var(--shapeships-grey-90)] px-[20px] py-[16px]${hasMotion ? ' ss-hoverPanelMotion' : ''}`}
          data-hover-panel-motion-direction={hasMotion ? (isLeft ? 'left' : 'right') : undefined}
          data-hover-panel-motion-state={motionState ?? undefined}
          style={{
            pointerEvents: 'none',
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-[10px] border border-solid border-[var(--shapeships-grey-70)] pointer-events-none"
          />

          <div
            aria-hidden="true"
            className="absolute top-1/2 size-[12px] -translate-y-1/2 rotate-45 border-solid border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] pointer-events-none"
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
      </div>
    </div>,
    portalTarget
  );
}
