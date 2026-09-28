import { useLayoutEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import type { BoardStatBreakdownRowVm } from '../../../client/gameSession/types';
import { HoverPanelFrame } from '../../shared/HoverPanelFrame';
import type { HoverPanelMotionState } from '../../shared/useHoverPanelPresence';
import type {
  BoardStatHoverLayout,
  BoardStatHoverSectionVm,
  BoardStatMetricTone,
} from './boardStatPresentation';
import type { HealthBreakdownCardVm } from './healthBreakdownPresentation';
import {
  calculateBoardStatHoverLayout,
  formatBoardMetricBreakdownAmount,
} from './boardStatPresentation';

export type BoardStatBreakdownHoverCardContent =
  | { kind: 'breakdown'; rows: BoardStatBreakdownRowVm[] }
  | { kind: 'health'; card: HealthBreakdownCardVm }
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
        {signlessContribution ? formatBoardMetricBreakdownAmount(row) : row.amountText}
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
          signlessContribution
        />
      ))}
    </section>
  );
}

function HealthSection({ card }: { card: HealthBreakdownCardVm }) {
  const changeToneClass = card.changeTone === 'healing'
    ? 'text-[var(--shapeships-pastel-green)]'
    : card.changeTone === 'damage'
      ? 'text-[var(--shapeships-pastel-red)]'
      : 'text-[var(--shapeships-grey-50)]';

  return (
    <section className="flex flex-col">
      <h3 className="text-[12px] font-semibold leading-[15px] text-[var(--shapeships-grey-20)]">
        {card.heading}
      </h3>
      <div className="my-[8px] h-px bg-[var(--shapeships-grey-70)]" />
      <div className="flex items-center justify-between gap-[16px] text-[14px] leading-[20px]">
        <span className="min-w-0 text-white">{card.damageLabel}</span>
        <span className="shrink-0 font-bold text-[var(--shapeships-pastel-red)]">
          {card.damageText}
        </span>
      </div>
      <div className="flex items-center justify-between gap-[16px] text-[14px] leading-[20px]">
        <span className="min-w-0 text-white">{card.healingLabel}</span>
        <span className="shrink-0 font-bold text-[var(--shapeships-pastel-green)]">
          {card.healingText}
        </span>
      </div>
      <div className="my-[8px] h-px bg-[var(--shapeships-grey-70)]" />
      <div className="flex items-center justify-between gap-[16px] text-[14px] font-semibold leading-[20px]">
        <span className="min-w-0 text-white">Health Change</span>
        <span className={`shrink-0 ${changeToneClass}`}>{card.changeText}</span>
      </div>
    </section>
  );
}

function contentKey(content: BoardStatBreakdownHoverCardContent): string {
  if (content.kind === 'breakdown') {
    return content.rows
      .map((row) =>
        `${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? '' : ''}`
      )
      .join('|');
  }

  if (content.kind === 'health') {
    return [
      content.card.heading,
      content.card.turnNumber,
      content.card.healingText,
      content.card.damageText,
      content.card.changeText,
    ].join('|');
  }

  return content.sections
    .map((section) => [
      section.kind,
      section.totalText,
      ...section.rows.map((row) =>
        `${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? '' : ''}`
      ),
    ].join('|'))
    .join('|');
}

export function BoardStatBreakdownHoverCard({
  anchorRect,
  side,
  content,
  motionState,
}: BoardStatBreakdownHoverCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<BoardStatHoverLayout | null>(null);
  const measuredContentKey = contentKey(content);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

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
            ) : content.kind === 'health' ? (
              <HealthSection card={content.card} />
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
