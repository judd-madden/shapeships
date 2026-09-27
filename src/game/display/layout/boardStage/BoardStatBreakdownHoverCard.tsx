import { useLayoutEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import type { BoardStatBreakdownRowVm } from '../../../client/gameSession/types';
import { HoverPanelFrame } from '../../shared/HoverPanelFrame';
import type { HoverPanelMotionState } from '../../shared/useHoverPanelPresence';
import type {
  BoardStatHoverSectionVm,
  BoardStatMetricTone,
} from './boardStatPresentation';

type BoardStatBreakdownHoverCardContent =
  | { kind: 'breakdown'; rows: BoardStatBreakdownRowVm[] }
  | {
      kind: 'metric';
      sections: BoardStatHoverSectionVm[];
      tone: BoardStatMetricTone;
    };

interface BoardStatBreakdownHoverCardProps {
  anchorRect: DOMRect;
  side: 'left' | 'right';
  content: BoardStatBreakdownHoverCardContent;
  motionState?: HoverPanelMotionState | null;
}

interface CardLayout {
  left: number;
  top: number;
  placement: 'left' | 'right';
  tailOffset: number;
}

const VIEWPORT_PADDING_PX = 12;
const HOVER_GAP_PX = 8;
const TAIL_SIZE_PX = 12;
const TAIL_PROTRUSION_PX = TAIL_SIZE_PX / 2;
const MIN_TAIL_INSET_PX = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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

function MetricSection({
  section,
  tone,
}: {
  section: BoardStatHoverSectionVm;
  tone: BoardStatMetricTone;
}) {
  const toneClass = tone === 'damage'
    ? 'text-[var(--shapeships-pastel-red)]'
    : 'text-[var(--shapeships-pastel-green)]';

  return (
    <section className="flex flex-col gap-[4px]">
      <div className="flex items-center justify-between gap-[16px]">
        <p className="min-w-0 text-[12px] leading-[15px] uppercase text-[var(--shapeships-grey-20)]">
          <span className="font-semibold">{section.heading}</span>
          {section.showEstimateQualifier ? (
            <span className="font-normal"> (ESTIMATE)</span>
          ) : null}
        </p>
        <p className={`shrink-0 text-[14px] leading-[15px] font-black ${toneClass}`}>
          {section.totalText}
        </p>
      </div>

      {section.rows.map((row, index) => (
        <BreakdownRow
          key={`${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? index : index}`}
          row={row}
        />
      ))}
    </section>
  );
}

function contentKey(content: BoardStatBreakdownHoverCardContent): string {
  if (content.kind === 'breakdown') {
    return content.rows
      .map((row) => `${row.rowKind}:${row.label}:${row.amount}`)
      .join('|');
  }

  return content.sections
    .map((section) => `${section.kind}:${section.totalText}:${section.rows.length}`)
    .join('|');
}

export function BoardStatBreakdownHoverCard({
  anchorRect,
  side,
  content,
  motionState,
}: BoardStatBreakdownHoverCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<CardLayout | null>(null);
  const measuredContentKey = contentKey(content);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const sideOffset = HOVER_GAP_PX + TAIL_PROTRUSION_PX;
    const preferredPlacement = side;
    const leftSpace = anchorRect.left - sideOffset - VIEWPORT_PADDING_PX;
    const rightSpace = window.innerWidth - VIEWPORT_PADDING_PX - anchorRect.right - sideOffset;
    const preferredFits = preferredPlacement === 'left'
      ? leftSpace >= cardRect.width
      : rightSpace >= cardRect.width;
    const oppositeFits = preferredPlacement === 'left'
      ? rightSpace >= cardRect.width
      : leftSpace >= cardRect.width;
    const placement = preferredFits
      ? preferredPlacement
      : oppositeFits
        ? preferredPlacement === 'left' ? 'right' : 'left'
        : leftSpace >= rightSpace ? 'left' : 'right';
    const desiredLeft = placement === 'left'
      ? anchorRect.left - sideOffset - cardRect.width
      : anchorRect.right + sideOffset;
    const maxLeft = Math.max(
      VIEWPORT_PADDING_PX,
      window.innerWidth - VIEWPORT_PADDING_PX - cardRect.width,
    );
    const left = clamp(desiredLeft, VIEWPORT_PADDING_PX, maxLeft);
    const desiredTop = anchorRect.top + (anchorRect.height / 2) - (cardRect.height / 2);
    const maxTop = Math.max(
      VIEWPORT_PADDING_PX,
      window.innerHeight - VIEWPORT_PADDING_PX - cardRect.height,
    );
    const top = clamp(desiredTop, VIEWPORT_PADDING_PX, maxTop);
    const tailMax = Math.max(MIN_TAIL_INSET_PX, cardRect.height - MIN_TAIL_INSET_PX);
    const tailOffset = clamp(
      anchorRect.top + (anchorRect.height / 2) - top,
      MIN_TAIL_INSET_PX,
      tailMax,
    );
    const nextLayout = { left, top, placement, tailOffset };

    setLayout((current) =>
      current &&
      current.left === nextLayout.left &&
      current.top === nextLayout.top &&
      current.placement === nextLayout.placement &&
      current.tailOffset === nextLayout.tailOffset
        ? current
        : nextLayout
    );
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
      <div ref={cardRef} className="relative w-[240px] max-w-[calc(100vw-24px)]">
        <HoverPanelFrame
          placement={placement}
          motionDirection={placement}
          motionState={motionState}
          tailOffset={layout ? `${layout.tailOffset}px` : undefined}
          className="w-full"
        >
          <div className="flex max-h-[calc(100vh-24px)] w-full flex-col overflow-hidden px-[20px] py-[16px]">
            {content.kind === 'metric' ? (
              content.sections.map((section, index) => (
                <div key={section.kind}>
                  {index > 0 ? (
                    <div className="my-[12px] h-px bg-[var(--shapeships-grey-70)]" />
                  ) : null}
                  <MetricSection section={section} tone={content.tone} />
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-[4px]">
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
