import type { RefObject } from 'react';
import type { BoardStatBreakdownRowVm, BoardViewModel } from '../../client/useGameSession';
import { toSpeciesKey } from '../layout/boardStage/FleetArea';

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
  topAnchorRect: MobileStatAnchorRect;
  bottomAnchorRect: MobileStatAnchorRect;
  topPopoverRef?: RefObject<HTMLDivElement | null>;
  bottomPopoverRef?: RefObject<HTMLDivElement | null>;
}

interface StatSectionVm {
  key: string;
  title: string;
  total: number;
  tone: SectionTone;
  rows: BoardStatBreakdownRowVm[];
  secondaryRows?: Array<{ label: string; amountText: string }>;
}

const HORIZONTAL_MARGIN_PX = 16;
const CARD_GAP_PX = 10;

export function MobileStatBreakdownPopovers({
  boardVm,
  topAnchorRect,
  bottomAnchorRect,
  topPopoverRef,
  bottomPopoverRef,
}: MobileStatBreakdownPopoversProps) {
  const myDisplayedBonus =
    toSpeciesKey(boardVm.mySpeciesId) === 'centaur'
      ? boardVm.myBonusLinesOnEven
      : boardVm.myBonusLines;
  const opponentDisplayedBonus =
    toSpeciesKey(boardVm.opponentSpeciesId) === 'centaur'
      ? boardVm.opponentBonusLinesOnEven
      : boardVm.opponentBonusLines;

  const topSections: StatSectionVm[] = buildSections({
    healing: boardVm.opponentLastTurnHeal,
    healingRows: boardVm.opponentLastHealingBreakdownRows,
    damage: boardVm.opponentLastTurnDamage,
    damageRows: boardVm.opponentLastDamageBreakdownRows,
    bonus: opponentDisplayedBonus,
    bonusRows: boardVm.opponentBonusBreakdownRows,
    savedLines: boardVm.opponentDisplayedSavedLines,
    savedJoiningLines: boardVm.opponentDisplayedSavedJoiningLines,
  });

  const bottomSections: StatSectionVm[] = buildSections({
    healing: boardVm.myLastTurnHeal,
    healingRows: boardVm.myLastHealingBreakdownRows,
    damage: boardVm.myLastTurnDamage,
    damageRows: boardVm.myLastDamageBreakdownRows,
    bonus: myDisplayedBonus,
    bonusRows: boardVm.myBonusBreakdownRows,
    savedLines: boardVm.myDisplayedSavedLines,
    savedJoiningLines: boardVm.myDisplayedSavedJoiningLines,
  });

  return (
    <div className="fixed inset-0 z-[52] pointer-events-none">
      <MobileStatBreakdownCard
        refEl={topPopoverRef}
        side="top"
        anchorRect={topAnchorRect}
        sections={topSections}
      />
      <MobileStatBreakdownCard
        refEl={bottomPopoverRef}
        side="bottom"
        anchorRect={bottomAnchorRect}
        sections={bottomSections}
      />
    </div>
  );
}

function buildSections({
  healing,
  healingRows,
  damage,
  damageRows,
  bonus,
  bonusRows,
  savedLines,
  savedJoiningLines,
}: {
  healing: number;
  healingRows: BoardStatBreakdownRowVm[];
  damage: number;
  damageRows: BoardStatBreakdownRowVm[];
  bonus: number;
  bonusRows: BoardStatBreakdownRowVm[];
  savedLines: number;
  savedJoiningLines: number;
}): StatSectionVm[] {
  return [
    {
      key: 'healing',
      title: 'Last turn healing',
      total: healing,
      tone: 'healing',
      rows: healing === 0 ? [] : healingRows,
    },
    {
      key: 'damage',
      title: 'Last turn damage',
      total: damage,
      tone: 'damage',
      rows: damage === 0 ? [] : damageRows,
    },
    {
      key: 'bonus',
      title: 'Bonus',
      total: bonus,
      tone: 'bonus',
      rows: bonusRows,
    },
    {
      key: 'saved',
      title: 'Saved lines',
      total: savedLines,
      tone: 'saved',
      rows: [],
      secondaryRows: savedJoiningLines > 0
        ? [{ label: 'Saved joining lines', amountText: String(savedJoiningLines) }]
        : undefined,
    },
  ];
}

function MobileStatBreakdownCard({
  refEl,
  side,
  anchorRect,
  sections,
}: {
  refEl?: RefObject<HTMLDivElement | null>;
  side: PopoverSide;
  anchorRect: MobileStatAnchorRect;
  sections: StatSectionVm[];
}) {
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

  return (
    <div
      ref={refEl}
      className="fixed pointer-events-auto"
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
          className="overflow-y-auto rounded-[10px] border border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] px-[16px] py-[12px] shadow-[0_0_60px_20px_rgba(0,0,0,1)]"
          style={{ maxHeight }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-y-[16px]">
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
        </div>
      </div>
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
          {section.total}
        </span>
      </div>

      {section.rows.length > 0 || section.secondaryRows?.length ? (
        <div className="flex flex-col gap-[3px]">
          {section.rows.map((row, index) => (
            <BreakdownRow
              key={`${row.rowKind}:${row.label}:${row.amount}:${row.count ?? index}`}
              row={row}
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

function BreakdownRow({ row }: { row: BoardStatBreakdownRowVm }) {
  return (
    <div className="flex items-start justify-between gap-[8px] text-[12px] leading-[15px]">
      {row.rowKind === 'ship' ? (
        <span className="min-w-0 flex flex-1 items-baseline gap-[3px] text-[var(--shapeships-grey-20)]">
          <span className="shrink-0 text-white">{row.count ?? 0}</span>
          <span className="shrink-0 text-[var(--shapeships-grey-50)]">x</span>
          <span className="min-w-0 truncate">{row.label}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[var(--shapeships-grey-20)]">{row.label}</span>
      )}
      <span className="shrink-0 font-bold text-white">{row.amountText}</span>
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
