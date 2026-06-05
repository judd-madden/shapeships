import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Dice } from '../../../components/ui/primitives';
import type {
  BoardViewModel,
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import { MobileDiceModifierSlots } from './MobileDiceModifierSlots';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;
type MobileRowPosition = 'top' | 'bottom';

interface MobileStatusRailProps {
  hudVm: HudViewModel;
  boardVm: MobileBoardViewModel;
  leftRailVm: LeftRailViewModel;
  mobileDiceModifierSlots: MobileBoardViewModel['mobileDiceModifierSlots'];
  firstTurnBuildHelperEligible?: boolean;
  firstTurnBuildHelperDismissSignal?: number;
  onFirstTurnBuildHelperDismiss?: () => void;
  topRowRef?: RefObject<HTMLDivElement | null>;
  bottomRowRef?: RefObject<HTMLDivElement | null>;
  topStatsAnchorRef?: RefObject<HTMLDivElement | null>;
  bottomStatsAnchorRef?: RefObject<HTMLDivElement | null>;
  onStatusRowToggle?: () => void;
}

export interface MobileStatusRailRowData {
  name: string;
  statusText: string;
  statusTone: HudStatusTone;
  isOnline: boolean;
  health?: number;
  netDelta?: number;
  healing?: number;
  damage?: number;
  bonus?: number;
  joiningBonus?: number;
  savedLines?: number;
  savedJoiningLines?: number;
}

interface MobileStatusRailFrameProps {
  topRow: MobileStatusRailRowData;
  bottomRow: MobileStatusRailRowData;
  showDeltas?: boolean;
  topClock: string;
  bottomClock: string;
  diceValue: LeftRailViewModel['diceValue'];
  diceAnimateKey: number;
  mobileDiceModifierSlots?: MobileBoardViewModel['mobileDiceModifierSlots'];
  firstTurnBuildHelperEligible?: boolean;
  firstTurnBuildHelperDismissSignal?: number;
  onFirstTurnBuildHelperDismiss?: () => void;
  topRowRef?: RefObject<HTMLDivElement | null>;
  bottomRowRef?: RefObject<HTMLDivElement | null>;
  topStatsAnchorRef?: RefObject<HTMLDivElement | null>;
  bottomStatsAnchorRef?: RefObject<HTMLDivElement | null>;
  onStatusRowToggle?: () => void;
}

const EMPTY_MOBILE_DICE_MODIFIER_SLOTS: MobileBoardViewModel['mobileDiceModifierSlots'] = {
  top: null,
  bottom: null,
};

const FIRST_TURN_BUILD_HELPER_SHOW_DELAY_MS = 500;
const FIRST_TURN_BUILD_HELPER_FADE_MS = 150;

export function MobileStatusRail({
  hudVm,
  boardVm,
  leftRailVm,
  mobileDiceModifierSlots,
  firstTurnBuildHelperEligible = false,
  firstTurnBuildHelperDismissSignal = 0,
  onFirstTurnBuildHelperDismiss,
  topRowRef,
  bottomRowRef,
  topStatsAnchorRef,
  bottomStatsAnchorRef,
  onStatusRowToggle,
}: MobileStatusRailProps) {
  const opponentStatus: MobileStatusRailRowData = {
    name: hudVm.p2Name,
    statusText: hudVm.p2StatusText ?? '',
    statusTone: hudVm.p2StatusTone,
    isOnline: hudVm.p2IsOnline,
    health: boardVm.opponentHealth,
    netDelta: boardVm.opponentLastTurnNet,
    healing: boardVm.opponentLastTurnHeal,
    damage: boardVm.opponentLastTurnDamage,
    bonus: boardVm.opponentBonusLines,
    joiningBonus: boardVm.opponentJoiningBonusLines,
    savedLines: boardVm.opponentDisplayedSavedLines,
    savedJoiningLines: boardVm.opponentDisplayedSavedJoiningLines,
  };

  const currentPlayerStatus: MobileStatusRailRowData = {
    name: hudVm.p1Name,
    statusText: hudVm.p1StatusText ?? '',
    statusTone: hudVm.p1StatusTone,
    isOnline: hudVm.p1IsOnline,
    health: boardVm.myHealth,
    netDelta: boardVm.myLastTurnNet,
    healing: boardVm.myLastTurnHeal,
    damage: boardVm.myLastTurnDamage,
    bonus: boardVm.myBonusLines,
    joiningBonus: boardVm.myJoiningBonusLines,
    savedLines: boardVm.myDisplayedSavedLines,
    savedJoiningLines: boardVm.myDisplayedSavedJoiningLines,
  };
  const showDeltas = boardVm.turnNumber > 1 || boardVm.healthDeltaPresentationKey != null;

  return (
    <MobileStatusRailFrame
      topRow={opponentStatus}
      bottomRow={currentPlayerStatus}
      showDeltas={showDeltas}
      topClock={hudVm.p2Clock}
      bottomClock={hudVm.p1Clock}
      diceValue={leftRailVm.diceValue}
      diceAnimateKey={leftRailVm.diceAnimateKey}
      mobileDiceModifierSlots={mobileDiceModifierSlots}
      firstTurnBuildHelperEligible={firstTurnBuildHelperEligible}
      firstTurnBuildHelperDismissSignal={firstTurnBuildHelperDismissSignal}
      onFirstTurnBuildHelperDismiss={onFirstTurnBuildHelperDismiss}
      topRowRef={topRowRef}
      bottomRowRef={bottomRowRef}
      topStatsAnchorRef={topStatsAnchorRef}
      bottomStatsAnchorRef={bottomStatsAnchorRef}
      onStatusRowToggle={onStatusRowToggle}
    />
  );
}

export function MobileStatusRailFrame({
  topRow,
  bottomRow,
  showDeltas = true,
  topClock,
  bottomClock,
  diceValue,
  diceAnimateKey,
  mobileDiceModifierSlots = EMPTY_MOBILE_DICE_MODIFIER_SLOTS,
  firstTurnBuildHelperEligible = false,
  firstTurnBuildHelperDismissSignal = 0,
  onFirstTurnBuildHelperDismiss,
  topRowRef,
  bottomRowRef,
  topStatsAnchorRef,
  bottomStatsAnchorRef,
  onStatusRowToggle,
}: MobileStatusRailFrameProps) {
  const [isFirstTurnBuildHelperMounted, setIsFirstTurnBuildHelperMounted] = useState(false);
  const [isFirstTurnBuildHelperVisible, setIsFirstTurnBuildHelperVisible] = useState(false);
  const firstTurnBuildHelperShowTimeoutRef = useRef<number | null>(null);
  const firstTurnBuildHelperDismissTimeoutRef = useRef<number | null>(null);

  function clearFirstTurnBuildHelperShowTimeout() {
    if (firstTurnBuildHelperShowTimeoutRef.current !== null) {
      window.clearTimeout(firstTurnBuildHelperShowTimeoutRef.current);
      firstTurnBuildHelperShowTimeoutRef.current = null;
    }
  }

  function clearFirstTurnBuildHelperDismissTimeout() {
    if (firstTurnBuildHelperDismissTimeoutRef.current !== null) {
      window.clearTimeout(firstTurnBuildHelperDismissTimeoutRef.current);
      firstTurnBuildHelperDismissTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearFirstTurnBuildHelperShowTimeout();
      clearFirstTurnBuildHelperDismissTimeout();
    };
  }, []);

  useEffect(() => {
    if (firstTurnBuildHelperDismissSignal === 0) {
      return;
    }

    setIsFirstTurnBuildHelperMounted(true);
    clearFirstTurnBuildHelperShowTimeout();
    clearFirstTurnBuildHelperDismissTimeout();
    setIsFirstTurnBuildHelperVisible(false);

    firstTurnBuildHelperDismissTimeoutRef.current = window.setTimeout(() => {
      firstTurnBuildHelperDismissTimeoutRef.current = null;
      setIsFirstTurnBuildHelperMounted(false);
    }, FIRST_TURN_BUILD_HELPER_FADE_MS);
  }, [firstTurnBuildHelperDismissSignal]);

  useEffect(() => {
    if (!firstTurnBuildHelperEligible) {
      clearFirstTurnBuildHelperShowTimeout();
      clearFirstTurnBuildHelperDismissTimeout();
      setIsFirstTurnBuildHelperMounted(false);
      setIsFirstTurnBuildHelperVisible(false);
      return;
    }

    if (firstTurnBuildHelperDismissSignal > 0) {
      clearFirstTurnBuildHelperShowTimeout();
      return;
    }

    clearFirstTurnBuildHelperShowTimeout();
    clearFirstTurnBuildHelperDismissTimeout();
    setIsFirstTurnBuildHelperMounted(true);
    setIsFirstTurnBuildHelperVisible(false);

    firstTurnBuildHelperShowTimeoutRef.current = window.setTimeout(() => {
      firstTurnBuildHelperShowTimeoutRef.current = null;
      setIsFirstTurnBuildHelperVisible(true);
    }, FIRST_TURN_BUILD_HELPER_SHOW_DELAY_MS);

    return () => {
      clearFirstTurnBuildHelperShowTimeout();
    };
  }, [firstTurnBuildHelperEligible, firstTurnBuildHelperDismissSignal]);

  return (
    <div className="relative shrink-0 w-full py-[8px]">
      <MobileDiceModifierSlots slots={mobileDiceModifierSlots} />
      <div className="flex items-stretch gap-[12px] px-[14px] w-full">
        <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
          <MobilePlayerStatusRow
            rowRef={topRowRef}
            statsAnchorRef={topStatsAnchorRef}
            row={topRow}
            position="top"
            showDeltas={showDeltas}
            onToggle={onStatusRowToggle}
          />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
          <MobilePlayerStatusRow
            rowRef={bottomRowRef}
            statsAnchorRef={bottomStatsAnchorRef}
            row={bottomRow}
            position="bottom"
            showDeltas={showDeltas}
            onToggle={onStatusRowToggle}
          />
        </div>

        <div className="shrink-0 w-[56px] flex flex-col items-center justify-between py-[1px]">
          <span className="w-[56px] truncate text-center text-[15px] font-bold leading-4 text-[var(--shapeships-grey-50)]">
            {topClock}
          </span>
          <div className="relative flex items-center justify-center">
            <Dice
              value={diceValue}
              animateKey={diceAnimateKey}
              className="w-[52px] h-[52px]"
              enableRotate={false}
            />
            {isFirstTurnBuildHelperMounted && (
              <div
                className="pointer-events-none absolute right-0 top-[calc(100%+32px)] z-[30]"
                style={{
                  opacity: isFirstTurnBuildHelperVisible ? 1 : 0,
                  transition: `opacity ${FIRST_TURN_BUILD_HELPER_FADE_MS}ms ease-out`,
                }}
              >
                <button
                  type="button"
                  className="pointer-events-auto relative flex w-[180px] max-w-[200px] flex-col gap-2.5 rounded-[10px] bg-[var(--shapeships-pastel-green)] p-[12px] text-left text-[var(--shapeships-black)]"
                  onClick={onFirstTurnBuildHelperDismiss}
                >
                  <span
                    aria-hidden="true"
                    className="absolute right-[18px] top-[-5px] size-[10px] rotate-45 bg-[var(--shapeships-pastel-green)]"
                  />
                  <span
                    className="font-['Roboto'] text-[14px] font-black leading-[16px]"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    The dice gives lines to both players.
                  </span>
                  <span className="flex flex-col gap-2.5">
                    <span
                      className="font-['Roboto'] text-[12px] font-normal leading-[14px]"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      You start with <span className="font-bold">3 saved lines</span>.
                    </span>
                    <span
                      className="font-['Roboto'] text-[12px] font-normal leading-[14px]"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      Spend lines to build ships. Unspent lines are saved.
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <span className="w-[56px] truncate text-center text-[15px] font-bold leading-4 text-white">
            {bottomClock}
          </span>
        </div>
      </div>
    </div>
  );
}

function MobilePlayerStatusRow({
  rowRef,
  statsAnchorRef,
  row,
  position,
  showDeltas,
  onToggle,
}: {
  rowRef?: RefObject<HTMLDivElement | null>;
  statsAnchorRef?: RefObject<HTMLDivElement | null>;
  row: MobileStatusRailRowData;
  position: MobileRowPosition;
  showDeltas: boolean;
  onToggle?: () => void;
}) {
  const health = row.health;
  const netDelta = row.netDelta;
  const hasHealth = health !== undefined;
  const hasNetDelta = netDelta !== undefined;
  const shouldShowNetDelta = hasNetDelta && showDeltas;
  const isInteractive = onToggle !== undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  }

  return (
    <div
      ref={rowRef}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={`${
        position === 'top' ? 'flex items-end w-full' : 'flex items-start w-full'
      } ${isInteractive ? 'cursor-pointer touch-manipulation' : ''}`}
    >
      <div className="flex-1 min-w-0 flex items-center justify-between gap-[6px]">
        <div className="flex flex-1 min-w-0 items-center gap-[5px]">
          <div className="flex w-[38px] shrink-0 flex-col items-center text-center font-bold whitespace-nowrap">
            <span className={`text-[26px] leading-[26px] ${hasHealth ? 'text-white' : 'text-transparent'}`}>
              {hasHealth ? health : 0}
            </span>
            <span className={`text-[15px] leading-[16px] ${shouldShowNetDelta ? getNetDeltaClassName(netDelta) : 'text-transparent'}`}>
              {hasNetDelta ? formatNetDelta(netDelta) : 0}
            </span>
          </div>

          <div className="flex flex-1 min-w-0 flex-col gap-[1px]">
            <div className="flex h-[19px] w-full min-w-0 items-center gap-[4px]">
              <OnlineDot isOnline={row.isOnline} />
              <span className="min-w-0 flex-1 truncate text-[17px] leading-[19px] text-white">
                {row.name}
              </span>
            </div>
            <div className="flex h-[16px] items-center pl-[11px]">
              <span className={`truncate text-[13px] font-bold leading-4 ${getStatusClassName(row.statusTone)}`}>
                {row.statusText || <span aria-hidden="true">&nbsp;</span>}
              </span>
            </div>
          </div>
        </div>

        <div
          ref={statsAnchorRef}
          className="grid shrink-0 grid-cols-[28px_28px_24px_24px] items-start gap-[3px] text-center font-bold whitespace-nowrap"
        >
          <span className={`text-[15px] ${row.healing === undefined ? 'text-transparent' : 'text-[var(--shapeships-pastel-green)]'}`}>
            {row.healing ?? 0}
          </span>
          <span className={`text-[15px] ${row.damage === undefined ? 'text-transparent' : 'text-[var(--shapeships-pastel-red)]'}`}>
            {row.damage ?? 0}
          </span>
          <MobileStackedStat
            value={row.bonus}
            joiningValue={row.joiningBonus}
            toneClassName="text-[var(--shapeships-pastel-blue)]"
          />
          <MobileStackedStat
            value={row.savedLines}
            joiningValue={row.savedJoiningLines}
            toneClassName="text-white"
          />
        </div>
      </div>
    </div>
  );
}

function MobileStackedStat({
  value,
  joiningValue,
  toneClassName,
}: {
  value?: number;
  joiningValue?: number;
  toneClassName: string;
}) {
  const hasValue = value !== undefined;

  return (
    <span className={`flex flex-col items-center justify-end ${hasValue ? toneClassName : 'text-transparent'}`}>
      <span className="text-[15px]">{value ?? 0}</span>
      <span className="text-[10px] leading-[10px]">{joiningValue && joiningValue > 0 ? `${joiningValue}j` : ''}</span>
    </span>
  );
}

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-[7px] shrink-0 rounded-full ${
        isOnline ? 'bg-[var(--shapeships-green)]' : 'bg-[var(--shapeships-grey-50)]'
      }`}
    />
  );
}

function formatNetDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return String(value);
  }

  return '±0';
}

function getNetDeltaClassName(value?: number): string {
  if (value === undefined) {
    return 'text-transparent';
  }

  if (value > 0) {
    return 'text-[var(--shapeships-pastel-green)]';
  }

  if (value < 0) {
    return 'text-[var(--shapeships-pastel-red)]';
  }

  return 'text-[var(--shapeships-grey-50)]';
}

function getStatusClassName(tone: HudStatusTone): string {
  if (tone === 'ready') {
    return 'text-[var(--shapeships-pastel-green)]';
  }

  if (tone === 'hidden') {
    return 'text-transparent';
  }

  return 'text-white';
}
