/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type {
  BoardViewModel,
  GameSessionActions,
  GameSessionViewModel,
} from '../../client/useGameSession';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';
import { FleetArea, toSpeciesKey } from './boardStage/FleetArea';
import { FleetShipHoverCard } from './boardStage/FleetShipHoverCard';
import { useFleetShipHover } from './boardStage/useFleetShipHover';
import {
  BoardStatBreakdownHoverCard,
  type BoardStatBreakdownHoverCardContent,
} from './boardStage/BoardStatBreakdownHoverCard';
import { useBoardStatHover, type BoardStatHoverKey } from './boardStage/useBoardStatHover';
import {
  buildBoardStatHoverSections,
  formatBoardStatMetric,
  selectBoardStatHoverAnchor,
} from './boardStage/boardStatPresentation';
import { usePresentedFleetRevealPulse } from './boardStage/usePresentedFleetRevealPulse';
import {
  MatchupIntroPlayerOverlay,
  MatchupIntroVersus,
} from '../matchup/MatchupIntroPresentation';
import type { MatchupIntroViewModel } from '../../client/gameSession/matchupIntro';
import { buildHealthBreakdownPresentation } from './boardStage/healthBreakdownPresentation';

interface BoardStageProps {
  vm: BoardViewModel;
  thisTurn: GameSessionViewModel['thisTurn'];
  presentedThisTurnStats: GameSessionViewModel['presentedThisTurnStats'];
  gameStats: GameSessionViewModel['gameStats'];
  viewer: GameSessionViewModel['viewer'];
  matchupIntro: MatchupIntroViewModel | null;
  actions: GameSessionActions;
  phaseKey: string;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function useAnimatedHealth(targetValue: number): number {
  const [displayedValue, setDisplayedValue] = useState(targetValue);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayedValue(targetValue);
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setDisplayedValue((currentValue) => {
      if (currentValue === targetValue) return currentValue;

      const direction = targetValue > currentValue ? 1 : -1;
      const distance = Math.abs(targetValue - currentValue);
      const totalDurationMs = Math.min(300, Math.max(180, distance * 36));
      const stepDurationMs = totalDurationMs / distance;
      const animationStart = performance.now();

      const tick = (now: number) => {
        const elapsed = now - animationStart;
        const stepsCompleted = Math.min(distance, Math.max(1, Math.floor(elapsed / stepDurationMs)));
        const nextValue = currentValue + (stepsCompleted * direction);

        setDisplayedValue(nextValue);

        if (nextValue !== targetValue) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return currentValue;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetValue]);

  return displayedValue;
}

function Metric({
  value,
  label,
  label2,
  align = 'left',
  toneClass = 'text-white',
  className,
}: {
  value: string;
  label?: string;
  label2?: string;
  align?: 'left' | 'right';
  toneClass?: string;
  className?: string;
}) {
  const isRight = align === 'right';
  const hasLabel = Boolean(label || label2);

  return (
    <div
      className={cx(
        'content-stretch flex flex-col relative shrink-0',
        className,
        toneClass,
        isRight && 'items-end text-right'
      )}
    >
      <p
        className="font-bold leading-[36px] relative shrink-0 text-[36px] w-[50px] min-[768px]:max-[1599px]:text-[30px] min-[768px]:max-[1599px]:leading-[30px] min-[768px]:max-[1599px]:w-[42px]"
      >
        {value}
      </p>

      {hasLabel ? (
        <p
          className={cx(
            "font-normal leading-[normal] relative shrink-0 text-[11px] text-nowrap uppercase",
            isRight && 'text-right'
          )}
        >
          {label}
          {label2 ? (
            <>
              <br aria-hidden="true" />
              {label2}
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function HoverAnchor({
  hoverKey,
  isTrackable,
  anchorRef,
  className,
  onHoverEnter,
  onHoverLeave,
  children,
}: {
  hoverKey: BoardStatHoverKey;
  isTrackable: boolean;
  anchorRef?: { current: HTMLElement | null };
  className?: string;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
  children: ReactNode;
}) {
  return (
      <div
        className={cx(className, 'cursor-default select-none')}
        onMouseEnter={
          isTrackable
            ? (event) => onHoverEnter(hoverKey, anchorRef?.current ?? event.currentTarget)
            : undefined
        }
        onMouseLeave={isTrackable ? () => onHoverLeave(hoverKey) : undefined}
      >
      {children}
    </div>
  );
}

function PairedStatTrigger({
  currentValue,
  lastValue,
  align,
  hoverKey,
  hoverTrackable,
  ariaLabel,
  isActive,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  onBlur,
}: {
  currentValue: string;
  lastValue: string;
  align: 'left' | 'right';
  hoverKey: BoardStatHoverKey;
  hoverTrackable: boolean;
  ariaLabel: string;
  isActive: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
  onFocus: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onBlur: (key: BoardStatHoverKey) => void;
}) {
  const isRight = align === 'right';
  const numericAnchorRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (isActive && numericAnchorRef.current) {
      onHoverEnter(hoverKey, numericAnchorRef.current);
    }
  }, [currentValue, hoverKey, isActive, lastValue, onHoverEnter]);

  return (
    <button
      type="button"
      disabled={!hoverTrackable}
      aria-label={ariaLabel}
      className={cx(
        'flex w-[80px] shrink-0 flex-col gap-[2px] rounded-[4px] bg-transparent p-0 text-inherit',
        'min-[768px]:max-[1599px]:w-[66px]',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white',
        isRight ? 'items-end text-right' : 'items-start text-left',
      )}
      onMouseEnter={
        hoverTrackable
          ? (event) => onHoverEnter(
              hoverKey,
              selectBoardStatHoverAnchor<HTMLElement>(
                numericAnchorRef.current,
                event.currentTarget,
              ),
            )
          : undefined
      }
      onMouseLeave={
        hoverTrackable
          ? (event) => {
              if (event.currentTarget !== document.activeElement) {
                onHoverLeave(hoverKey);
              }
            }
          : undefined
      }
      onFocus={
        hoverTrackable
          ? (event) => onFocus(
              hoverKey,
              selectBoardStatHoverAnchor<HTMLElement>(
                numericAnchorRef.current,
                event.currentTarget,
              ),
            )
          : undefined
      }
      onBlur={hoverTrackable ? () => onBlur(hoverKey) : undefined}
    >
      <span ref={numericAnchorRef} className="inline-flex w-max flex-col gap-[2px]">
        <span className="font-bold text-[36px] leading-[36px] min-[768px]:max-[1599px]:text-[30px] min-[768px]:max-[1599px]:leading-[30px]">
          {currentValue}
        </span>
        <span className="font-bold text-[24px] leading-[24px] opacity-[0.66] min-[768px]:max-[1599px]:text-[20px] min-[768px]:max-[1599px]:leading-[20px]">
          {lastValue}
        </span>
      </span>
    </button>
  );
}

function PairedStatGroup({
  leftCurrent,
  leftLast,
  rightCurrent,
  rightLast,
  metricLabel,
  toneClass,
  activeHoverKey,
  leftHoverKey,
  leftHoverTrackable,
  rightHoverKey,
  rightHoverTrackable,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  onBlur,
}: {
  leftCurrent: string;
  leftLast: string;
  rightCurrent: string;
  rightLast: string;
  metricLabel: 'Damage' | 'Healing';
  toneClass: string;
  activeHoverKey: BoardStatHoverKey | null;
  leftHoverKey: BoardStatHoverKey;
  leftHoverTrackable: boolean;
  rightHoverKey: BoardStatHoverKey;
  rightHoverTrackable: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
  onFocus: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onBlur: (key: BoardStatHoverKey) => void;
}) {
  return (
    <div className={cx('content-stretch flex gap-[10px] items-start justify-center relative shrink-0', toneClass)}>
      <PairedStatTrigger
        currentValue={leftCurrent}
        lastValue={leftLast}
        align="right"
        hoverKey={leftHoverKey}
        hoverTrackable={leftHoverTrackable}
        ariaLabel={`My ${metricLabel}: ${leftCurrent} this turn, ${leftLast} last turn`}
        isActive={activeHoverKey === leftHoverKey}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <div className="flex w-[64px] shrink-0 flex-col gap-[2px] text-center min-[768px]:max-[1599px]:w-[56px]">
        <p className="flex h-[36px] items-center justify-center text-[14px] font-normal leading-[normal] min-[768px]:max-[1599px]:h-[30px] min-[768px]:max-[1599px]:text-[13px]">
          {metricLabel}
        </p>
        <p className="flex h-[24px] items-center justify-center text-[14px] font-normal leading-[normal] opacity-[0.66] min-[768px]:max-[1599px]:h-[20px] min-[768px]:max-[1599px]:text-[13px]">
          Last
        </p>
      </div>
      <PairedStatTrigger
        currentValue={rightCurrent}
        lastValue={rightLast}
        align="left"
        hoverKey={rightHoverKey}
        hoverTrackable={rightHoverTrackable}
        ariaLabel={`Opponent ${metricLabel}: ${rightCurrent} this turn, ${rightLast} last turn`}
        isActive={activeHoverKey === rightHoverKey}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
}

function HealthTrigger({
  health,
  netDelta,
  showDelta,
  deltaKey,
  animateDelta,
  align,
  hoverKey,
  hoverTrackable,
  ariaLabel,
  isActive,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  onBlur,
}: {
  health: number;
  netDelta: number;
  showDelta: boolean;
  deltaKey: string;
  animateDelta: boolean;
  align: 'left' | 'right';
  hoverKey: BoardStatHoverKey;
  hoverTrackable: boolean;
  ariaLabel: string;
  isActive: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
  onFocus: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onBlur: (key: BoardStatHoverKey) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const isRight = align === 'right';
  const deltaText = netDelta > 0 ? `+${netDelta}` : netDelta === 0 ? '±0' : `−${Math.abs(netDelta)}`;

  useLayoutEffect(() => {
    if (isActive && anchorRef.current) {
      onHoverEnter(hoverKey, anchorRef.current);
    }
  }, [deltaText, health, hoverKey, isActive, onHoverEnter, showDelta]);

  return (
    <button
      ref={anchorRef}
      type="button"
      disabled={!hoverTrackable}
      aria-label={ariaLabel}
      className={cx(
        'inline-flex w-max flex-col rounded-[4px] bg-transparent p-0 font-bold text-inherit',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white',
        isRight ? 'items-end text-right' : 'items-start text-left',
      )}
      onMouseEnter={hoverTrackable ? (event) => onHoverEnter(hoverKey, event.currentTarget) : undefined}
      onMouseLeave={
        hoverTrackable
          ? (event) => {
              if (event.currentTarget !== document.activeElement) {
                onHoverLeave(hoverKey);
              }
            }
          : undefined
      }
      onFocus={hoverTrackable ? (event) => onFocus(hoverKey, event.currentTarget) : undefined}
      onBlur={hoverTrackable ? () => onBlur(hoverKey) : undefined}
    >
      <span className="text-[64px] leading-[64px] text-white min-[768px]:max-[1599px]:text-[56px] min-[768px]:max-[1599px]:leading-[56px]">
        {health}
      </span>
      <span
        className="text-[28px] leading-[28px]"
        style={{
          color: netDelta > 0
            ? 'var(--shapeships-pastel-green)'
            : netDelta < 0
              ? 'var(--shapeships-pastel-red)'
              : 'var(--shapeships-grey-50)',
          opacity: showDelta ? 1 : 0,
          pointerEvents: showDelta ? 'auto' : 'none',
        }}
      >
        <span
          key={deltaKey}
          className={showDelta && animateDelta ? 'ss-health-delta-pop-in' : undefined}
        >
          {showDelta ? deltaText : ''}
        </span>
      </span>
    </button>
  );
}

export function BoardStage({
  vm,
  thisTurn,
  presentedThisTurnStats,
  gameStats,
  viewer,
  matchupIntro,
  actions,
  phaseKey,
}: BoardStageProps) {
  const isBattleReveal = phaseKey === 'battle.reveal';
  const fleetHover = useFleetShipHover();
  const statHover = useBoardStatHover();
  const myBonusAnchorRef = useRef<HTMLDivElement | null>(null);
  const opponentBonusPrimaryAnchorRef = useRef<HTMLDivElement | null>(null);
  const opponentBonusJoiningAnchorRef = useRef<HTMLDivElement | null>(null);
  const displayedMyHealth = useAnimatedHealth(vm.mode === 'board' ? vm.myHealth : 25);
  const displayedOpponentHealth = useAnimatedHealth(vm.mode === 'board' ? vm.opponentHealth : 25);
  const leftRevealPulse = usePresentedFleetRevealPulse(
    vm.mode === 'board' ? vm.presentedMyRevealBlurSeq ?? 0 : null
  );
  const rightRevealPulse = usePresentedFleetRevealPulse(
    vm.mode === 'board' ? vm.presentedOpponentRevealBlurSeq : null
  );

  // Choose species mode
  if (vm.mode === 'choose_species') {
    return (
      <ChooseSpeciesStage
        vm={vm}
        onSelectSpecies={actions.onSelectSpecies}
        onSelectBotSpecies={actions.onSelectBotSpecies}
        onConfirmSpecies={actions.onConfirmSpecies}
        onCopyGameUrl={actions.onCopyGameUrl}
      />
    );
  }

  const mySpeciesKey = toSpeciesKey(vm.mySpeciesId);
  const opponentSpeciesKey = toSpeciesKey(vm.opponentSpeciesId);
  const myDisplayedBonusLines =
    mySpeciesKey === 'centaur' ? vm.myBonusLinesOnEven : vm.myBonusLines;
  const opponentDisplayedBonusLines =
    opponentSpeciesKey === 'centaur'
      ? vm.opponentBonusLinesOnEven
      : vm.opponentBonusLines;

  const healthBreakdown = buildHealthBreakdownPresentation({
    boardVm: vm,
    thisTurn,
    gameStats,
    viewer,
  });
  // Preserve the established delta lifecycle, with the confirmed turn-one final exception.
  const showDeltas = healthBreakdown.deltaVisible;
  const shouldAnimateDeltas = vm.healthDeltaPresentationKey != null;
  const myDeltaKey = !showDeltas
    ? 'my:hidden'
    : shouldAnimateDeltas
      ? `my:resolution:${vm.healthDeltaPresentationKey}`
      : 'my:stable';
  const opponentDeltaKey = !showDeltas
    ? 'opp:hidden'
    : shouldAnimateDeltas
      ? `opp:resolution:${vm.healthDeltaPresentationKey}`
      : 'opp:stable';
  const myDamagePair = presentedThisTurnStats?.me.damage ?? null;
  const opponentDamagePair = presentedThisTurnStats?.opponent.damage ?? null;
  const myHealingPair = presentedThisTurnStats?.me.healing ?? null;
  const opponentHealingPair = presentedThisTurnStats?.opponent.healing ?? null;
  const myDamageHoverSections = buildBoardStatHoverSections(myDamagePair);
  const opponentDamageHoverSections = buildBoardStatHoverSections(opponentDamagePair);
  const myHealingHoverSections = buildBoardStatHoverSections(myHealingPair);
  const opponentHealingHoverSections = buildBoardStatHoverSections(opponentHealingPair);
  const myDamageHoverTrackable = myDamageHoverSections.length > 0;
  const opponentDamageHoverTrackable = opponentDamageHoverSections.length > 0;
  const myHealingHoverTrackable = myHealingHoverSections.length > 0;
  const opponentHealingHoverTrackable = opponentHealingHoverSections.length > 0;
  const myBonusClusterHasVisibleContent =
    myDisplayedBonusLines !== 0 || vm.myJoiningBonusLines > 0;
  const opponentBonusClusterHasVisibleContent =
    opponentDisplayedBonusLines !== 0 || vm.opponentJoiningBonusLines > 0;
  const myBonusHoverTrackable =
    vm.showTurnStartEconomyPresentation &&
    (myBonusClusterHasVisibleContent || vm.myBonusBreakdownRows.length > 0);
  const opponentBonusHoverTrackable =
    vm.showTurnStartEconomyPresentation &&
    (opponentBonusClusterHasVisibleContent || vm.opponentBonusBreakdownRows.length > 0);
  const opponentBonusAnchorRef =
    vm.opponentJoiningBonusLines > 0 ? opponentBonusJoiningAnchorRef : opponentBonusPrimaryAnchorRef;
  type ActiveStatHover = {
    side: 'left' | 'right';
    content: BoardStatBreakdownHoverCardContent;
  };
  const statHoverContentByKey: Partial<Record<BoardStatHoverKey, ActiveStatHover>> = {
    ...(healthBreakdown.my
      ? {
          'my-health': {
            side: 'left' as const,
            content: { kind: 'health' as const, card: healthBreakdown.my },
          },
        }
      : {}),
    ...(healthBreakdown.opponent
      ? {
          'opponent-health': {
            side: 'right' as const,
            content: { kind: 'health' as const, card: healthBreakdown.opponent },
          },
        }
      : {}),
    'my-damage': {
      side: 'left',
      content: { kind: 'metric', sections: myDamageHoverSections, tone: 'damage' },
    },
    'opponent-damage': {
      side: 'right',
      content: { kind: 'metric', sections: opponentDamageHoverSections, tone: 'damage' },
    },
    'my-healing': {
      side: 'left',
      content: { kind: 'metric', sections: myHealingHoverSections, tone: 'healing' },
    },
    'opponent-healing': {
      side: 'right',
      content: { kind: 'metric', sections: opponentHealingHoverSections, tone: 'healing' },
    },
    'my-bonus': {
      side: 'left',
      content: { kind: 'breakdown', rows: vm.myBonusBreakdownRows },
    },
    'opponent-bonus': {
      side: 'right',
      content: { kind: 'breakdown', rows: vm.opponentBonusBreakdownRows },
    },
  };
  const activeStatHover =
    statHover.presentState.activeKey
      ? statHoverContentByKey[statHover.presentState.activeKey]
      : null;
  const shouldRenderActiveStatHover = activeStatHover?.content.kind === 'metric'
    ? activeStatHover.content.sections.length > 0
    : activeStatHover?.content.kind === 'health'
      ? true
      : (activeStatHover?.content.rows.length ?? 0) > 0;

  // Board mode
  return (
    <div
      className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full"
      data-name="Board Stage"
    >
      <FleetArea 
        title="MY FLEET" 
        ships={vm.myFleet} 
        ancientSolarEntries={vm.myAncientSolarEntries}
        isBattleReveal={isBattleReveal}
        voidShips={vm.myVoidFleet}
        order={vm.myFleetRenderOrder} 
        species={mySpeciesKey}
        animTokens={vm.fleetAnim.my}
        flipEnabled={vm.mode === 'board'}
        side="my"
        activationIndexMap={vm.activationStaggerPlan?.myIndexByShipId}
        healthDeltaFlash={vm.myFleetHealthDeltaFlash}
        targetStatesByStackKey={vm.destroyTargeting?.targetStatesBySide.my}
        previewShipDefIdByStackKey={vm.destroyTargeting?.previewShipDefIdBySide.my}
        onDestroyTargetHoverChange={actions.onDestroyTargetStackHoverChange}
        onDestroyTargetMouseDown={actions.onDestroyTargetStackMouseDown}
        onLiveFleetBackgroundMouseDown={actions.onBoardBackgroundMouseDown}
        onFleetHoverEnter={fleetHover.onEnter}
        onFleetHoverLeave={fleetHover.onLeave}
        turnPulse={leftRevealPulse}
        overlay={matchupIntro ? (
          <MatchupIntroPlayerOverlay
            matchupIntro={matchupIntro}
            player={matchupIntro.localPlayer}
            variant="desktop"
            direction="from-right"
          />
        ) : null}
      />

      <div
        className="content-stretch flex flex-col h-full items-center justify-between relative shrink-0 w-[230px] cursor-default select-none min-[768px]:max-[1599px]:w-[200px]"
        data-name="Health and Stats"
      >
        {/* Health */}
        <div
          className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full"
          data-name="Health Wrapper"
        >
          <div
            className="content-stretch flex flex-col font-bold gap-px items-end relative shrink-0 text-right w-[100px] min-[768px]:max-[1599px]:w-[86px]"
            data-name="P1 Health Group"
          >
            <HealthTrigger
              health={displayedMyHealth}
              netDelta={vm.myLastTurnNet}
              showDelta={showDeltas}
              deltaKey={myDeltaKey}
              animateDelta={shouldAnimateDeltas}
              align="right"
              hoverKey="my-health"
              hoverTrackable={healthBreakdown.hoverEligible}
              ariaLabel={`Health ${displayedMyHealth}, change ${healthBreakdown.my?.changeText ?? 'unavailable'}. Show health breakdown`}
              isActive={statHover.state.activeKey === 'my-health'}
              onHoverEnter={statHover.onEnter}
              onHoverLeave={statHover.onLeave}
              onFocus={statHover.onFocus}
              onBlur={statHover.onBlur}
            />
          </div>

          <div
            className="content-stretch flex items-center justify-center pb-0 pt-[22px] px-0 relative shrink-0"
            data-name="Health Label"
          >
            <div className="flex flex-col items-center justify-start w-[64px] text-center min-[768px]:max-[1599px]:w-[56px]">
              <p
                className="font-normal leading-[1.25] relative shrink-0 text-white text-[15px] min-[768px]:max-[1599px]:text-[13px]"
              >
                Health
              </p>

              {/* Max Health */}
              <p
                className="font-bold leading-[13px] relative shrink-0 text-[13px]"
                style={{
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {vm.myMaxHealth === 35 && vm.opponentMaxHealth === 35
                  ? '35'
                  : `${vm.myMaxHealth} / ${vm.opponentMaxHealth}`}
              </p>
            </div>
          </div>

          <div
            className="content-stretch flex flex-col font-bold items-start relative shrink-0 w-[100px] min-[768px]:max-[1599px]:w-[86px]"
            data-name="P2 Health Group"
          >
            <HealthTrigger
              health={displayedOpponentHealth}
              netDelta={vm.opponentLastTurnNet}
              showDelta={showDeltas}
              deltaKey={opponentDeltaKey}
              animateDelta={shouldAnimateDeltas}
              align="left"
              hoverKey="opponent-health"
              hoverTrackable={healthBreakdown.hoverEligible}
              ariaLabel={`Health ${displayedOpponentHealth}, change ${healthBreakdown.opponent?.changeText ?? 'unavailable'}. Show health breakdown`}
              isActive={statHover.state.activeKey === 'opponent-health'}
              onHoverEnter={statHover.onEnter}
              onHoverLeave={statHover.onLeave}
              onFocus={statHover.onFocus}
              onBlur={statHover.onBlur}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0 w-full min-[768px]:max-[1599px]:gap-[12px]" data-name="Stats Wrapper">
          {/* Saved Lines */}
          {vm.showTurnStartEconomyPresentation ? (
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Saved Lines Group">
            {/* P1 */}
            <div className="content-stretch flex items-start justify-end relative shrink-0 w-[100px] min-[768px]:max-[1599px]:w-[86px]" data-name="P1 Saved Wrapper">
              <div className="content-stretch flex items-start relative shrink-0">
                <Metric value={String(vm.myDisplayedSavedLines)} align="right" toneClass="text-white" />
                {vm.myDisplayedSavedJoiningLines > 0 ? (
                  <Metric
                    value={String(vm.myDisplayedSavedJoiningLines)}
                    label="JOINING"
                    align="right"
                    toneClass="text-white"
                  />
                ) : null}
              </div>
            </div>
          
            <p
              className="font-normal leading-[normal] relative shrink-0 text-[15px] text-center text-white w-[64px] min-[768px]:max-[1599px]:text-[13px] min-[768px]:max-[1599px]:w-[56px]"
            >
              Saved
              <br aria-hidden="true" />
              Lines
            </p>
          
            {/* P2 */}
            <div className="content-stretch flex items-start relative shrink-0 w-[100px] min-[768px]:max-[1599px]:w-[86px]" data-name="P2 Saved Wrapper">
              <div className="content-stretch flex items-start relative shrink-0">
                <Metric value={String(vm.opponentDisplayedSavedLines)} align="left" toneClass="text-white" />
                {vm.opponentDisplayedSavedJoiningLines > 0 ? (
                  <Metric
                    value={String(vm.opponentDisplayedSavedJoiningLines)}
                    label="JOINING"
                    align="left"
                    toneClass="text-white"
                  />
                ) : null}
              </div>
            </div>
          </div>
          ) : null}

          {/* Bonus */}
          {vm.showTurnStartEconomyPresentation ? (
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Bonus Group">
            <div className="content-stretch flex gap-[4px] items-center justify-end relative shrink-0 w-[100px] min-[768px]:max-[1599px]:w-[86px]" data-name="P1 Bonuses">
              <HoverAnchor
                hoverKey="my-bonus"
                isTrackable={myBonusHoverTrackable}
                anchorRef={myBonusAnchorRef}
                onHoverEnter={statHover.onEnter}
                onHoverLeave={statHover.onLeave}
                className="flex gap-[4px] items-center justify-end"
              >
                <div ref={myBonusAnchorRef} className="shrink-0">
                  <Metric
                    value={String(myDisplayedBonusLines ?? 0)}
                    label="LINES"
                    label2={mySpeciesKey === 'centaur' ? 'ON EVEN' : undefined}
                    align="right"
                    toneClass="text-[var(--shapeships-pastel-blue)]"
                  />
                </div>
                {vm.myJoiningBonusLines > 0 ? (
                  <Metric
                    value={String(vm.myJoiningBonusLines)}
                    label="JOINING"
                    label2="LINES"
                    align="right"
                    toneClass="text-[var(--shapeships-pastel-blue)]"
                  />
                ) : null}
              </HoverAnchor>
            </div>

            <div className="content-stretch flex items-center justify-center pb-0 pt-[8px] px-0 relative shrink-0">
              <p
                className="font-normal leading-[normal] relative shrink-0 text-[var(--shapeships-pastel-blue)] text-[15px] text-center w-[64px] min-[768px]:max-[1599px]:text-[13px] min-[768px]:max-[1599px]:w-[56px]"
              >
                Bonus
              </p>
            </div>

            <div className="content-stretch flex gap-[4px] items-start relative shrink-0 w-[100px] min-[768px]:max-[1599px]:w-[86px]" data-name="P2 Bonuses">
              <HoverAnchor
                hoverKey="opponent-bonus"
                isTrackable={opponentBonusHoverTrackable}
                anchorRef={opponentBonusAnchorRef}
                onHoverEnter={statHover.onEnter}
                onHoverLeave={statHover.onLeave}
                className="flex gap-[4px] items-start"
              >
                <div ref={opponentBonusPrimaryAnchorRef} className="shrink-0">
                  <Metric
                    value={String(opponentDisplayedBonusLines ?? 0)}
                    label="LINES"
                    label2={opponentSpeciesKey === 'centaur' ? 'ON EVEN' : undefined}
                    align="left"
                    toneClass="text-[var(--shapeships-pastel-blue)]"
                  />
                </div>
                {vm.opponentJoiningBonusLines > 0 ? (
                  <div ref={opponentBonusJoiningAnchorRef} className="shrink-0">
                    <Metric
                      value={String(vm.opponentJoiningBonusLines)}
                      label="JOINING"
                      label2="LINES"
                      align="left"
                      toneClass="text-[var(--shapeships-pastel-blue)]"
                    />
                  </div>
                ) : null}
              </HoverAnchor>
            </div>
          </div>
          ) : null}

          <PairedStatGroup
            leftCurrent={formatBoardStatMetric(myDamagePair?.current, 'current')}
            leftLast={formatBoardStatMetric(myDamagePair?.last, 'last')}
            rightCurrent={formatBoardStatMetric(opponentDamagePair?.current, 'current')}
            rightLast={formatBoardStatMetric(opponentDamagePair?.last, 'last')}
            metricLabel="Damage"
            toneClass="text-[var(--shapeships-pastel-red)]"
            activeHoverKey={statHover.state.activeKey}
            leftHoverKey="my-damage"
            leftHoverTrackable={myDamageHoverTrackable}
            rightHoverKey="opponent-damage"
            rightHoverTrackable={opponentDamageHoverTrackable}
            onHoverEnter={statHover.onEnter}
            onHoverLeave={statHover.onLeave}
            onFocus={statHover.onFocus}
            onBlur={statHover.onBlur}
          />
          <PairedStatGroup
            leftCurrent={formatBoardStatMetric(myHealingPair?.current, 'current')}
            leftLast={formatBoardStatMetric(myHealingPair?.last, 'last')}
            rightCurrent={formatBoardStatMetric(opponentHealingPair?.current, 'current')}
            rightLast={formatBoardStatMetric(opponentHealingPair?.last, 'last')}
            metricLabel="Healing"
            toneClass="text-[var(--shapeships-pastel-green)]"
            activeHoverKey={statHover.state.activeKey}
            leftHoverKey="my-healing"
            leftHoverTrackable={myHealingHoverTrackable}
            rightHoverKey="opponent-healing"
            rightHoverTrackable={opponentHealingHoverTrackable}
            onHoverEnter={statHover.onEnter}
            onHoverLeave={statHover.onLeave}
            onFocus={statHover.onFocus}
            onBlur={statHover.onBlur}
          />
        </div>

        {matchupIntro ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden select-none">
            <div className="-translate-y-[29px]">
              <MatchupIntroVersus matchupIntro={matchupIntro} variant="desktop" />
            </div>
          </div>
        ) : null}
      </div>

      <FleetArea 
        title="OPPONENT FLEET" 
        ships={vm.opponentFleet} 
        ancientSolarEntries={vm.opponentAncientSolarEntries}
        isBattleReveal={isBattleReveal}
        voidShips={vm.opponentVoidFleet}
        order={vm.opponentFleetRenderOrder} 
        species={opponentSpeciesKey}
        animTokens={vm.fleetAnim.opponent}
        flipEnabled={vm.mode === 'board'}
        side="opponent"
        activationIndexMap={vm.activationStaggerPlan?.opponentIndexByShipId}
        healthDeltaFlash={vm.opponentFleetHealthDeltaFlash}
        targetStatesByStackKey={vm.destroyTargeting?.targetStatesBySide.opponent}
        previewShipDefIdByStackKey={vm.destroyTargeting?.previewShipDefIdBySide.opponent}
        onDestroyTargetHoverChange={actions.onDestroyTargetStackHoverChange}
        onDestroyTargetMouseDown={actions.onDestroyTargetStackMouseDown}
        onLiveFleetBackgroundMouseDown={actions.onBoardBackgroundMouseDown}
        onFleetHoverEnter={fleetHover.onEnter}
        onFleetHoverLeave={fleetHover.onLeave}
        turnPulse={rightRevealPulse}
        overlay={matchupIntro ? (
          <MatchupIntroPlayerOverlay
            matchupIntro={matchupIntro}
            player={matchupIntro.opponentPlayer}
            variant="desktop"
            direction="from-left"
          />
        ) : null}
      />

      {fleetHover.presentState.activeShipId && fleetHover.presentState.anchorRect ? (
        <FleetShipHoverCard
          shipId={fleetHover.presentState.activeShipId}
          anchorRect={fleetHover.presentState.anchorRect}
          motionState={fleetHover.motionState}
        />
      ) : null}

      {activeStatHover && statHover.presentState.anchorRect && shouldRenderActiveStatHover ? (
        <BoardStatBreakdownHoverCard
          anchorRect={statHover.presentState.anchorRect}
          side={activeStatHover.side}
          content={activeStatHover.content}
          motionState={statHover.motionState}
        />
      ) : null}
    </div>
  );
}
