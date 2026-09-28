import { useRef, type PointerEvent, type RefObject } from 'react';
import type {
  BoardStatBreakdownRowVm,
  BoardViewModel,
  GameSessionViewModel,
} from '../../client/useGameSession';
import { toSpeciesKey } from '../layout/boardStage/FleetArea';
import {
  buildMobileMetricBreakdownGroups,
  formatMobileBreakdownAmount,
  isMobilePopoverTapGesture,
  type MobileMetricBreakdownSectionVm,
} from './mobileStatPresentation';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;
type PopoverSide = 'top' | 'bottom';
type SectionTone = 'healing' | 'damage' | 'bonus' | 'saved';

export interface MobileStatAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface MobileStatBreakdownPopoversProps {
  boardVm: MobileBoardViewModel;
  thisTurn: GameSessionViewModel['thisTurn'];
  topAnchorRect: MobileStatAnchorRect;
  bottomAnchorRect: MobileStatAnchorRect;
  topPopoverRef?: RefObject<HTMLDivElement | null>;
  bottomPopoverRef?: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
}

interface StatSectionVm {
  key: string;
  title: string;
  totalText: string;
  tone: SectionTone;
  rows: BoardStatBreakdownRowVm[];
  secondaryRows?: Array<{ label: string; amountText: string }>;
  signlessContributions?: boolean;
}

const HORIZONTAL_MARGIN_PX = 16;
const CARD_GAP_PX = 10;

export function MobileStatBreakdownPopovers({
  boardVm,
  thisTurn,
  topAnchorRect,
  bottomAnchorRect,
  topPopoverRef,
  bottomPopoverRef,
  onDismiss,
}: MobileStatBreakdownPopoversProps) {
  const myDisplayedBonus =
    toSpeciesKey(boardVm.mySpeciesId) === 'centaur'
      ? boardVm.myBonusLinesOnEven
      : boardVm.myBonusLines;
  const opponentDisplayedBonus =
    toSpeciesKey(boardVm.opponentSpeciesId) === 'centaur'
      ? boardVm.opponentBonusLinesOnEven
      : boardVm.opponentBonusLines;

  const topMetricGroups = buildMobileMetricBreakdownGroups({
    presentation: thisTurn,
    side: 'opponent',
  });
  const bottomMetricGroups = buildMobileMetricBreakdownGroups({
    presentation: thisTurn,
    side: 'me',
  });
  const topSections: StatSectionVm[] = [
    ...buildEconomySections({
      bonus: opponentDisplayedBonus,
      bonusRows: boardVm.opponentBonusBreakdownRows,
      savedLines: boardVm.opponentDisplayedSavedLines,
      savedJoiningLines: boardVm.opponentDisplayedSavedJoiningLines,
    }),
    ...topMetricGroups.primary.map(toStatSection),
  ];
  const bottomSections: StatSectionVm[] = [
    ...buildEconomySections({
      bonus: myDisplayedBonus,
      bonusRows: boardVm.myBonusBreakdownRows,
      savedLines: boardVm.myDisplayedSavedLines,
      savedJoiningLines: boardVm.myDisplayedSavedJoiningLines,
    }),
    ...bottomMetricGroups.primary.map(toStatSection),
  ];
  const bottomLastSections = bottomMetricGroups.last.map(toStatSection);

  return (
    <div className="fixed inset-0 z-[52] pointer-events-none">
      <MobileStatBreakdownCard
        refEl={topPopoverRef}
        side="top"
        anchorRect={topAnchorRect}
        primarySections={topSections}
        lastSections={[]}
        onDismiss={onDismiss}
      />
      <MobileStatBreakdownCard
        refEl={bottomPopoverRef}
        side="bottom"
        anchorRect={bottomAnchorRect}
        primarySections={bottomSections}
        lastSections={bottomLastSections}
        onDismiss={onDismiss}
      />
    </div>
  );
}

function buildEconomySections({
  bonus,
  bonusRows,
  savedLines,
  savedJoiningLines,
}: {
  bonus: number;
  bonusRows: BoardStatBreakdownRowVm[];
  savedLines: number;
  savedJoiningLines: number;
}): StatSectionVm[] {
  return [
    {
      key: 'saved',
      title: 'Saved lines',
      totalText: String(savedLines),
      tone: 'saved',
      rows: [],
      secondaryRows: savedJoiningLines > 0
        ? [{ label: 'Saved joining lines', amountText: String(savedJoiningLines) }]
        : undefined,
    },
    {
      key: 'bonus',
      title: 'Bonus lines',
      totalText: String(bonus),
      tone: 'bonus',
      rows: bonusRows,
    },
  ];
}

function toStatSection(section: MobileMetricBreakdownSectionVm): StatSectionVm {
  return {
    ...section,
    signlessContributions: true,
  };
}

function MobileStatBreakdownCard({
  refEl,
  side,
  anchorRect,
  primarySections,
  lastSections,
  onDismiss,
}: {
  refEl?: RefObject<HTMLDivElement | null>;
  side: PopoverSide;
  anchorRect: MobileStatAnchorRect;
  primarySections: StatSectionVm[];
  lastSections: StatSectionVm[];
  onDismiss: () => void;
}) {
  const pointerStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const viewportWidth = typeof window === 'undefined' ? 360 : window.innerWidth;
  const width = Math.max(0, viewportWidth - HORIZONTAL_MARGIN_PX * 2);
  const left = HORIZONTAL_MARGIN_PX;
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const tailLeft = clamp(anchorCenterX - left - 6, 18, Math.max(18, width - 30));
  const top = side === 'top'
    ? Math.max(8, anchorRect.top - CARD_GAP_PX)
    : anchorRect.bottom + CARD_GAP_PX;
  const maxHeight = side === 'top'
    ? Math.max(120, anchorRect.top - CARD_GAP_PX - 8)
    : Math.max(120, (typeof window === 'undefined' ? 800 : window.innerHeight) - top - 8);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) {
      return;
    }

    pointerStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (
      !event.isPrimary ||
      !start ||
      start.pointerId !== event.pointerId ||
      !isMobilePopoverTapGesture(start, event)
    ) {
      return;
    }

    onDismiss();
  }

  return (
    <div
      ref={refEl}
      className="fixed pointer-events-auto touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartRef.current = null;
      }}
      style={{
        left,
        top,
        width,
        transform: side === 'top' ? 'translateY(-100%)' : undefined,
      }}
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className={`absolute size-[12px] rotate-45 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] ${
            side === 'top'
              ? 'bottom-[-6px] border-b border-r'
              : 'top-[-6px] border-l border-t'
          }`}
          style={{ left: tailLeft }}
        />
        <div
          className="overflow-y-auto overscroll-contain rounded-[10px] border border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] shadow-[0_0_60px_20px_rgba(0,0,0,1)]"
          style={{ maxHeight }}
        >
          <SectionGrid sections={primarySections} className="px-[16px] py-[12px]" />
          {lastSections.length > 0 ? (
            <SectionGrid
              sections={lastSections}
              className="border-t border-[var(--shapeships-grey-70)] bg-[#101010] px-[16px] py-[12px]"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionGrid({
  sections,
  className,
}: {
  sections: StatSectionVm[];
  className: string;
}) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-y-[16px] ${className}`}>
      {sections.map((section, index) => {
        const isLastOdd = sections.length % 2 === 1 && index === sections.length - 1;

        return (
          <BreakdownSection
            key={section.key}
            section={section}
            isRightColumn={index % 2 === 1 && !isLastOdd}
            spanFull={isLastOdd}
          />
        );
      })}
    </div>
  );
}

function BreakdownSection({
  section,
  isRightColumn,
  spanFull,
}: {
  section: StatSectionVm;
  isRightColumn: boolean;
  spanFull: boolean;
}) {
  return (
    <section
      className={`min-w-0 ${
        spanFull
          ? 'col-span-2'
          : isRightColumn
            ? 'border-l border-[var(--shapeships-grey-70)] pl-[16px]'
            : 'pr-[16px]'
      }`}
    >
      <div className="mb-[5px] flex min-w-0 items-baseline justify-between gap-[8px]">
        <h3 className={`min-w-0 truncate text-[13px] font-black leading-[15px] ${getToneClassName(section.tone)}`}>
          {section.title}
        </h3>
        <span className={`shrink-0 text-[15px] font-black leading-[16px] ${getToneClassName(section.tone)}`}>
          {section.totalText}
        </span>
      </div>

      {section.rows.length > 0 || section.secondaryRows?.length ? (
        <div className="flex flex-col gap-[3px]">
          {section.rows.map((row, index) => (
            <BreakdownRow
              key={`${row.rowKind}:${row.label}:${row.amount}:${'count' in row ? row.count ?? index : index}`}
              row={row}
              signlessContribution={section.signlessContributions === true}
            />
          ))}
          {section.secondaryRows?.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-[8px] text-[12px] leading-[15px]">
              <span className="min-w-0 flex-1 text-[var(--shapeships-grey-20)]">{row.label}</span>
              <span className="shrink-0 font-bold text-white">{row.amountText}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BreakdownRow({
  row,
  signlessContribution,
}: {
  row: BoardStatBreakdownRowVm;
  signlessContribution: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-[8px] text-[12px] leading-[15px]">
      {row.rowKind === 'ship' || row.rowKind === 'solar_power' ? (
        <span className="min-w-0 flex flex-1 items-baseline gap-[3px] text-[var(--shapeships-grey-20)]">
          <span className="shrink-0 text-white">{row.count ?? 0}</span>
          <span className="shrink-0 text-[var(--shapeships-grey-50)]">x</span>
          <span className="min-w-0 truncate">{row.label}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[var(--shapeships-grey-20)]">{row.label}</span>
      )}
      <span className="shrink-0 font-bold text-white">
        {formatMobileBreakdownAmount(row, signlessContribution)}
      </span>
    </div>
  );
}

function getToneClassName(tone: SectionTone): string {
  if (tone === 'healing') {
    return 'text-[var(--shapeships-pastel-green)]';
  }

  if (tone === 'damage') {
    return 'text-[var(--shapeships-pastel-red)]';
  }

  if (tone === 'bonus') {
    return 'text-[var(--shapeships-pastel-blue)]';
  }

  return 'text-white';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
