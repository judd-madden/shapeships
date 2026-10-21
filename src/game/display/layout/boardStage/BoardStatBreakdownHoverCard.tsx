import { useLayoutEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import type { BoardStatBreakdownRowVm } from '../../../client/gameSession/types';
import { HoverPanelFrame } from '../../shared/HoverPanelFrame';
import type { HoverPanelMotionState } from '../../shared/useHoverPanelPresence';
import type {
  BoardStatHoverLayout,
  BoardCombatBreakdownVm,
  BoardCombatColumnVm,
} from './boardStatPresentation';
import {
  calculateBoardStatHoverLayout,
  formatBoardMetricBreakdownAmount,
  getBoardCombatHeadingPresentation,
} from './boardStatPresentation';

export type BoardStatBreakdownHoverCardContent =
  | { kind: 'breakdown'; rows: BoardStatBreakdownRowVm[] }
  | { kind: 'win_streak'; count: number; rows: BoardStatBreakdownRowVm[] }
  | { kind: 'combat'; card: BoardCombatBreakdownVm };

interface BoardStatBreakdownHoverCardProps {
  anchorRect: DOMRect;
  side: 'left' | 'right';
  content: BoardStatBreakdownHoverCardContent;
  motionState?: HoverPanelMotionState | null;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const VIEWPORT_PADDING_PX = 12;

function BreakdownRow({
  row,
  signlessContribution = false,
}: {
  row: BoardStatBreakdownRowVm;
  signlessContribution?: boolean;
}) {
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
          <span className="min-w-0 truncate font-normal" title={row.label}>{row.label}</span>
        </div>
      ) : (
        <div
          className="min-w-0 truncate text-left font-normal text-white"
          title={row.label}
          style={{ fontSize: '14px', lineHeight: 1.4 }}
        >
          {row.label}
        </div>
      )}

      <div
        className="shrink-0 text-right font-black text-white"
        style={{ fontSize: '14px', lineHeight: 1.4 }}
      >
        {signlessContribution ? formatBoardMetricBreakdownAmount(row) : row.amountText}
      </div>
    </div>
  );
}

function CombatSection({ column }: { column: BoardCombatColumnVm }) {
  const toneClass = column.tone === 'damage'
    ? 'text-[var(--shapeships-pastel-red)]'
    : 'text-[var(--shapeships-pastel-green)]';

  return (
    <section className="flex min-w-0 flex-col gap-[4px]">
      <div className="flex items-center justify-between gap-[16px]">
        <p className="min-w-0 text-[12px] leading-[15px] uppercase text-[var(--shapeships-grey-20)]">
          <span className="font-semibold">{column.label}</span>
          {column.section?.showEstimateQualifier && column.section.estimateQualifierText ? (
            <span className="block font-normal">({column.section.estimateQualifierText})</span>
          ) : null}
        </p>
        <p className={`shrink-0 text-[14px] leading-[15px] font-black ${toneClass}`}>
          {column.totalText}
        </p>
      </div>

      {column.unavailableText ? (
        <p className="text-[12px] leading-[16px] text-[var(--shapeships-grey-20)]">{column.unavailableText}</p>
      ) : column.section?.rows.map((row, index) => (
        <BreakdownRow
          key={`${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? index : index}`}
          row={row}
          signlessContribution
        />
      ))}
    </section>
  );
}

export function BoardCombatBreakdown({ card }: { card: BoardCombatBreakdownVm }) {
  const period = getBoardCombatHeadingPresentation(card);
  return (
    <div className="flex shrink-0 flex-col">
      <h3 className="text-[12px] leading-[15px] uppercase text-[var(--shapeships-grey-20)]">
        <span className="font-semibold">{period.heading}</span>
        {period.qualifier ? <span className="font-normal"> ({period.qualifier})</span> : null}
      </h3>
      <div className="my-[8px] h-px bg-[var(--shapeships-grey-70)]" />
      <CombatSection column={card.damage} />
      <div className="my-[8px] h-px bg-[var(--shapeships-grey-70)]" />
      <CombatSection column={card.healing} />
    </div>
  );
}

export function BoardStatBreakdownHoverCard({
  anchorRect,
  side,
  content,
  motionState,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
}: BoardStatBreakdownHoverCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<BoardStatHoverLayout | null>(null);
  const measuredContentKey = JSON.stringify(content);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const updateLayout = () => {
      const cardRect = card.getBoundingClientRect();
      const nextLayout = calculateBoardStatHoverLayout({
        anchorRect,
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        preferredPlacement: side,
      });

      setLayout((current) =>
        current &&
        current.left === nextLayout.left &&
        current.top === nextLayout.top &&
        current.placement === nextLayout.placement &&
        current.tailOffset === nextLayout.tailOffset
          ? current
          : nextLayout
      );
    };
    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(card);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, [
    anchorRect.bottom,
    anchorRect.height,
    anchorRect.left,
    anchorRect.right,
    anchorRect.top,
    measuredContentKey,
    side,
  ]);

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  const placement = layout?.placement ?? side;

  return ReactDOM.createPortal(
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${layout?.left ?? VIEWPORT_PADDING_PX}px`,
        top: `${layout?.top ?? VIEWPORT_PADDING_PX}px`,
        visibility: layout ? 'visible' : 'hidden',
      }}
    >
      <div
        ref={cardRef}
        className="relative w-[240px] max-w-[calc(100vw-24px)]"
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
        onFocusCapture={onFocus}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur();
        }}
      >
        <HoverPanelFrame
          placement={placement}
          motionDirection={placement}
          motionState={motionState}
          tailOffset={layout ? `${layout.tailOffset}px` : undefined}
          className="w-full"
          interactive
        >
          <div
            id="board-stat-breakdown"
            role="region"
            aria-label={content.kind === 'combat' ? `${content.card.heading} combat breakdown` : 'Bonus breakdown'}
            tabIndex={0}
            className="flex max-h-[calc(100vh-24px)] w-full flex-col overflow-y-auto overscroll-contain rounded-[10px] px-[20px] py-[16px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
          >
            {content.kind === 'win_streak' ? (
              <div className="flex shrink-0 flex-col">
                <div className="flex items-center justify-between gap-[12px]">
                  <h3 className="text-[20px] font-black leading-[22px] text-[var(--shapeships-pastel-green)]">
                    {content.count} WIN STREAK
                  </h3>
                </div>
                <p className="mt-[8px] text-[16px] font-medium leading-[20px] text-white">
                  Computer opponent gains {content.count} bonus {content.count === 1 ? 'line' : 'lines'} at the start of the game.
                </p>
                {content.rows.length > 0 ? (
                  <div className="mt-[12px] flex flex-col gap-[4px] border-t border-[var(--shapeships-grey-70)] pt-[12px]">
                    {content.rows.map((row, index) => (
                      <BreakdownRow
                        key={`${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? index : index}`}
                        row={row}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : content.kind === 'combat' ? (
              <BoardCombatBreakdown card={content.card} />
            ) : (
              <div className="flex shrink-0 flex-col gap-[4px]">
                {content.rows.map((row, index) => (
                  <BreakdownRow
                    key={`${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? index : index}`}
                    row={row}
                  />
                ))}
              </div>
            )}
          </div>
        </HoverPanelFrame>
      </div>
    </div>,
    portalTarget
  );
}
