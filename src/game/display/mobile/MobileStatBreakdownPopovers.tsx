import { useRef, type PointerEvent, type ReactNode, type RefObject } from 'react';
import type {
  BoardStatBreakdownRowVm,
  BoardViewModel,
  GameSessionViewModel,
} from '../../client/useGameSession';
import {
  buildMobileCombatBreakdowns,
  getMobilePopoverTailLeft,
  formatMobileBreakdownAmount,
  isMobilePopoverTapGesture,
  type MobilePopoverPeriod,
} from './mobileStatPresentation';
import { getHealthContributionLabels } from '../layout/boardStage/healthBreakdownPresentation';
import {
  getBoardCombatHeadingPresentation,
  type BoardCombatBreakdownVm,
} from '../layout/boardStage/boardStatPresentation';
import type { WinStreakGameViewModel } from '../../client/winStreak/types';
import {
  shouldShowWinStreakBonusDetail,
  withoutWinStreakBreakdownRow,
} from '../winStreak/winStreakPresentation';

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
  viewer: GameSessionViewModel['viewer'];
  gameStats: GameSessionViewModel['gameStats'];
  period: MobilePopoverPeriod;
  onPeriodChange: (period: MobilePopoverPeriod) => void;
  boardCenterX: number;
  topAnchorRect: MobileStatAnchorRect;
  bottomAnchorRect: MobileStatAnchorRect;
  topPopoverRef?: RefObject<HTMLDivElement | null>;
  bottomPopoverRef?: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
  winStreak: WinStreakGameViewModel;
}

interface StatSectionVm {
  key: string;
  title: string;
  totalText: string;
  tone: SectionTone;
  rows: BoardStatBreakdownRowVm[];
  secondaryRows?: Array<{ label: string; amountText: string; purple?: boolean }>;
  signlessContributions?: boolean;
  unavailableText?: string;
  streakBonusCount?: number;
}

const HORIZONTAL_MARGIN_PX = 16;
const CARD_GAP_PX = 10;

export function MobileStatBreakdownPopovers({
  boardVm,
  thisTurn,
  viewer,
  gameStats,
  period,
  onPeriodChange,
  boardCenterX,
  topAnchorRect,
  bottomAnchorRect,
  topPopoverRef,
  bottomPopoverRef,
  onDismiss,
  winStreak,
}: MobileStatBreakdownPopoversProps) {
  const myDisplayedBonus = boardVm.myBonusLines;
  const opponentDisplayedBonus = boardVm.opponentBonusLines;

  const labels = getHealthContributionLabels(viewer, gameStats);
  const topCombat = buildMobileCombatBreakdowns({
    presentation: thisTurn, side: 'opponent',
    damageLabel: labels.viewerDamage, healingLabel: labels.opponentHealing,
  });
  const bottomCombat = buildMobileCombatBreakdowns({
    presentation: thisTurn, side: 'my',
    damageLabel: labels.opponentDamage, healingLabel: labels.viewerHealing,
  });
  const topEconomy = buildEconomySections({
    bonus: opponentDisplayedBonus,
    bonusRows: boardVm.opponentBonusBreakdownRows,
    savedLines: boardVm.opponentDisplayedSavedLines,
    savedJoiningLines: boardVm.opponentDisplayedSavedJoiningLines,
    fleetValue: boardVm.presentedFleetValue?.opponent,
    joiningBonus: boardVm.opponentJoiningBonusLines,
    bonusOnEven: boardVm.opponentSpeciesId === 'centaur' ? boardVm.opponentBonusLinesOnEven : undefined,
    streakBonusCount: shouldShowWinStreakBonusDetail(winStreak)
      ? winStreak.appliedBonus.count : undefined,
  });
  const bottomEconomy = buildEconomySections({
    bonus: myDisplayedBonus,
    bonusRows: boardVm.myBonusBreakdownRows,
    savedLines: boardVm.myDisplayedSavedLines,
    savedJoiningLines: boardVm.myDisplayedSavedJoiningLines,
    fleetValue: boardVm.presentedFleetValue?.my,
    joiningBonus: boardVm.myJoiningBonusLines,
    bonusOnEven: boardVm.mySpeciesId === 'centaur' ? boardVm.myBonusLinesOnEven : undefined,
  });

  return (
    <div className="fixed inset-0 z-[52] pointer-events-none">
      <MobilePopoverCardFrame
        refEl={topPopoverRef}
        side="top"
        anchorRect={topAnchorRect}
        boardCenterX={boardCenterX}
        onDismiss={onDismiss}
      >
        <MobileInspectionCardContent
          economy={topEconomy} combat={topCombat[period]} current={topCombat.current}
          period={period} onPeriodChange={onPeriodChange}
        />
      </MobilePopoverCardFrame>
      <MobilePopoverCardFrame
        refEl={bottomPopoverRef}
        side="bottom"
        anchorRect={bottomAnchorRect}
        boardCenterX={boardCenterX}
        onDismiss={onDismiss}
      >
        <MobileInspectionCardContent
          economy={bottomEconomy} combat={bottomCombat[period]} current={bottomCombat.current}
          period={period} onPeriodChange={onPeriodChange}
        />
      </MobilePopoverCardFrame>
    </div>
  );
}

function MobileInspectionCardContent({
  economy, combat, current, period, onPeriodChange,
}: {
  economy: StatSectionVm[];
  combat: BoardCombatBreakdownVm;
  current: BoardCombatBreakdownVm;
  period: MobilePopoverPeriod;
  onPeriodChange: (period: MobilePopoverPeriod) => void;
}) {
  const heading = getBoardCombatHeadingPresentation(current);
  const currentLabel = heading.heading + (heading.qualifier ? ' (ESTIMATE)' : '');
  return (
    <div className="px-[16px] py-[12px]">
      <SectionGrid sections={economy} className="" />
      <div className="my-[16px] flex items-baseline gap-[20px]">
        {(['last', 'current'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={period === value}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onPeriodChange(value);
            }}
            className={
              'bg-transparent p-0 text-left text-[12px] font-semibold leading-[15px] ' +
              (period === value ? 'text-white underline' : 'text-[var(--shapeships-grey-50)]')
            }
          >
            {value === 'last' ? 'LAST TURN' : currentLabel}
          </button>
        ))}
      </div>
      <SectionGrid
        sections={[combat.damage, combat.healing].map((column) => ({
          key: column.tone, title: column.label, totalText: column.totalText,
          tone: column.tone, rows: column.section?.rows ?? [],
          signlessContributions: true, unavailableText: column.unavailableText,
        }))}
        className=""
      />
    </div>
  );
}

function buildEconomySections({
  bonus,
  bonusRows,
  savedLines,
  savedJoiningLines,
  fleetValue,
  joiningBonus,
  bonusOnEven,
  streakBonusCount,
}: {
  bonus: number;
  bonusRows: BoardStatBreakdownRowVm[];
  savedLines: number;
  savedJoiningLines: number;
  fleetValue?: number;
  joiningBonus: number;
  bonusOnEven?: number;
  streakBonusCount?: number;
}): StatSectionVm[] {
  return [
    {
      key: 'saved',
      title: 'Saved lines',
      totalText: String(savedLines),
      tone: 'saved',
      rows: [],
      secondaryRows: [
        ...(fleetValue !== undefined ? [{ label: 'Fleet Value', amountText: String(fleetValue), purple: true }] : []),
        ...(savedJoiningLines > 0 ? [{ label: 'Saved joining lines', amountText: String(savedJoiningLines) }] : []),
      ],
    },
    {
      key: 'bonus',
      title: 'Bonus lines',
      totalText: String(bonus),
      tone: 'bonus',
      rows: streakBonusCount ? withoutWinStreakBreakdownRow(bonusRows) : bonusRows,
      streakBonusCount,
      secondaryRows: [
        ...(bonusOnEven !== undefined ? [{ label: 'Lines on even', amountText: String(bonusOnEven) }] : []),
        ...(joiningBonus > 0 ? [{ label: 'Joining lines', amountText: String(joiningBonus) }] : []),
      ],
    },
  ];
}

function MobilePopoverCardFrame({
  refEl,
  side,
  anchorRect,
  boardCenterX,
  onDismiss,
  children,
}: {
  refEl?: RefObject<HTMLDivElement | null>;
  side: PopoverSide;
  anchorRect: MobileStatAnchorRect;
  boardCenterX: number;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const pointerStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const viewportWidth = typeof window === 'undefined' ? 360 : window.innerWidth;
  const availableWidth = Math.max(0, viewportWidth - HORIZONTAL_MARGIN_PX * 2);
  const width = availableWidth;
  const left = HORIZONTAL_MARGIN_PX;
  const tailLeft = getMobilePopoverTailLeft(boardCenterX, left, width);
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
          {children}
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
        <h3 className={`min-w-0 truncate text-[13px] font-regular leading-[15px] ${getToneClassName(section.tone)}`}>
          {section.title}
        </h3>
        <span className={`shrink-0 text-[13px] font-black leading-[16px] ${getToneClassName(section.tone)}`}>
          {section.totalText}
        </span>
      </div>

      {section.unavailableText ? (
        <p className="text-[12px] leading-[15px] text-[var(--shapeships-grey-20)]">
          {section.unavailableText}
        </p>
      ) : null}

      {section.streakBonusCount ? (
        <div className="mb-[8px]">
          <div className="flex items-center justify-between gap-[8px] text-[14px] font-black leading-[16px]">
            <span className="text-[var(--shapeships-pastel-green)]">{section.streakBonusCount} WIN STREAK</span>
          </div>
          <p className="mt-[4px] text-[12px] font-medium leading-[15px] text-white">
            Computer opponent gains {section.streakBonusCount} bonus {section.streakBonusCount === 1 ? 'line' : 'lines'} at the start of the game.
          </p>
        </div>
      ) : null}

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
              <span className={row.purple ? 'shrink-0 font-bold text-[var(--shapeships-pastel-purple)]' : 'shrink-0 font-bold text-white'}>{row.amountText}</span>
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
