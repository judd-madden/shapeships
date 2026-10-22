/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type {
  BoardViewModel,
  GameSessionActions,
  GameSessionViewModel,
  HudViewModel,
} from '../../client/useGameSession';
import { TopHud } from './TopHud';
import { DesktopDicePresentation, type DesktopDicePresentationProps } from './boardStage/DesktopDicePresentation';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';
import { FleetArea, toSpeciesKey } from './boardStage/FleetArea';
import { FleetShipHoverCard } from './boardStage/FleetShipHoverCard';
import { useFleetShipHover } from './boardStage/useFleetShipHover';
import {
  BoardStatBreakdownHoverCard,
  type BoardStatBreakdownHoverCardContent,
} from './boardStage/BoardStatBreakdownHoverCard';
import { useBoardStatHover, type BoardStatHoverController, type BoardStatHoverKey } from './boardStage/useBoardStatHover';
import {
  buildCurrentBoardCombatBreakdown,
  formatBoardStatMetric,
  getAffectedHealthMetrics,
  type BoardCombatBreakdownVm,
} from './boardStage/boardStatPresentation';
import { usePresentedFleetRevealPulse } from './boardStage/usePresentedFleetRevealPulse';
import {
  MatchupIntroPlayerOverlay,
  MatchupIntroVersus,
} from '../matchup/MatchupIntroPresentation';
import type { MatchupIntroViewModel } from '../../client/gameSession/matchupIntro';
import {
  buildHealthBreakdownPresentation,
  buildResolvedBoardCombatBreakdown,
  getHealthContributionLabels,
  formatHealthChange,
} from './boardStage/healthBreakdownPresentation';
import {
  shouldShowWinStreakBonusDetail,
  withoutWinStreakBreakdownRow,
} from '../winStreak/winStreakPresentation';
import { HealthBarPair } from '../healthBars/HealthBar';
import {
  useDesktopHealthBarAxisLength, useDesktopHealthBarLegend, type SessionHealthBarPresentation,
} from '../healthBars/useSessionHealthBarPresentation';

interface BoardStageProps {
  desktopHealthPresentation: SessionHealthBarPresentation | null;
  desktopDicePresentation: DesktopDicePresentationProps;
  vm: BoardViewModel;
  hudVm: HudViewModel;
  thisTurn: GameSessionViewModel['thisTurn'];
  presentedThisTurnStats: GameSessionViewModel['presentedThisTurnStats'];
  gameStats: GameSessionViewModel['gameStats'];
  viewer: GameSessionViewModel['viewer'];
  matchupIntro: MatchupIntroViewModel | null;
  actions: GameSessionActions;
  phaseKey: string;
  winStreak: GameSessionViewModel['winStreak'];
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

interface BoardStageFrameProps {
  healthBars?: ReactNode;
  boardRootRef: RefObject<HTMLDivElement | null>;
  barRegionRef: RefObject<HTMLDivElement | null>;
  hudVm: HudViewModel;
  desktopDicePresentation: DesktopDicePresentationProps;
  isChoosingSpecies?: boolean;
  healthContent?: ReactNode;
  currentStatsContent?: ReactNode;
  statsContent?: ReactNode;
  matchupIntro?: MatchupIntroViewModel | null;
  children: ReactNode;
}

function BoardStageFrame({
  healthBars,
  boardRootRef,
  barRegionRef,
  hudVm,
  desktopDicePresentation,
  isChoosingSpecies = false,
  healthContent,
  currentStatsContent,
  statsContent,
  matchupIntro,
  children,
}: BoardStageFrameProps) {
  return (
    <div
      ref={boardRootRef}
      className="relative grid w-full min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--ss-board-center-width)_minmax(0,1fr)] grid-rows-[var(--ss-desktop-header-height)_minmax(0,1fr)] gap-x-[8px] [--ss-board-center-width:200px] min-[1600px]:[--ss-board-center-width:230px] [--ss-desktop-header-height:68px] max-[1199px]:[--ss-desktop-header-height:124px] min-[1400px]:[--ss-desktop-header-height:78px] min-[1920px]:[--ss-desktop-header-height:90px]"
      data-name="Board Stage"
    >
      <TopHud vm={hudVm} />
      {/* This slot stays mounted across setup/board returns; only its layout visibility changes. */}
      <div
        className={isChoosingSpecies ? 'hidden' : 'relative col-start-2 row-span-2 row-start-1 min-h-0 min-w-0 cursor-default select-none'}
        aria-hidden={isChoosingSpecies || undefined}
        inert={isChoosingSpecies || undefined}
        data-name="Health and Stats"
      >
        {/* The measured bar region yields first; metric spacers then compress. */}
        <div className="absolute inset-0 flex flex-col items-center overflow-visible" data-name="Central Stats Content">
          <div
            ref={barRegionRef}
            className="relative flex w-full min-h-[42px] basis-0 grow items-stretch justify-center min-[1400px]:min-h-[50px] min-[1920px]:min-h-[78px]"
            data-name="Desktop Health Bar Region"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">{healthBars}</div>
            {currentStatsContent}
          </div>
          <div className="flex w-[var(--ss-board-center-width)] min-h-0 shrink flex-col items-center [--ss-metric-value-height:20px] min-[1400px]:[--ss-metric-value-height:24px] min-[1920px]:[--ss-metric-value-height:28px] min-[2220px]:[--ss-metric-value-height:32px]" data-name="Existing Board Stats">
            <div aria-hidden="true" className="min-h-0 basis-[4px] shrink min-[1400px]:basis-[6px]" />
            {healthContent}
            <div aria-hidden="true" className="min-h-0 basis-[8px] shrink min-[1400px]:basis-[12px] min-[1920px]:basis-[16px] min-[2560px]:basis-[20px]" />
            <DesktopDicePresentation
              {...desktopDicePresentation}
              boardRootRef={boardRootRef}
              barRegionRef={barRegionRef}
              guidanceSuppressed={isChoosingSpecies || Boolean(matchupIntro) || desktopDicePresentation.guidanceSuppressed}
            />
            <div aria-hidden="true" className="min-h-0 basis-[8px] shrink min-[1400px]:basis-[12px] min-[1920px]:basis-[16px] min-[2560px]:basis-[20px]" />
            {statsContent}
            <div aria-hidden="true" className="min-h-0 basis-[8px] shrink min-[1400px]:basis-[12px] min-[1920px]:basis-[16px] min-[2560px]:basis-[20px]" />
          </div>
        </div>
        {matchupIntro ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--ss-desktop-header-height)] z-20 flex items-center justify-center overflow-hidden select-none">
            <div className="-translate-y-[29px]">
              <MatchupIntroVersus matchupIntro={matchupIntro} variant="desktop" />
            </div>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
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
        className="font-bold leading-none relative shrink-0 text-[20px] min-[1400px]:text-[24px] min-[1920px]:text-[28px] min-[2220px]:text-[32px] min-w-[32px] whitespace-nowrap"
      >
        {value}
      </p>

      <p
        aria-hidden={!hasLabel || undefined}
        className={cx(
          "font-normal leading-[normal] relative shrink-0 text-[11px] text-nowrap uppercase min-h-[calc(var(--ss-metric-label-lines)*1lh)]",
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
  onFocus,
  onBlur,
  children,
}: {
  hoverKey: BoardStatHoverKey;
  isTrackable: boolean;
  anchorRef?: { current: HTMLElement | null };
  className?: string;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
  onFocus: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onBlur: (key: BoardStatHoverKey) => void;
  children: ReactNode;
}) {
  return (
      <div
        className={cx(className, 'cursor-default select-none')}
        tabIndex={isTrackable ? 0 : undefined}
        aria-label={isTrackable ? 'Bonus breakdown. Down arrow to inspect.' : undefined}
        aria-controls={isTrackable ? 'board-stat-breakdown' : undefined}
        onFocus={isTrackable ? (event) => onFocus(hoverKey, anchorRef?.current ?? event.currentTarget) : undefined}
        onBlur={isTrackable ? () => onBlur(hoverKey) : undefined}
        onKeyDown={isTrackable ? focusStatBreakdown : undefined}
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

function CombatValues({
  damage,
  healing,
  previous = false,
}: {
  damage: string;
  healing: string;
  previous?: boolean;
}) {
  return (
    <span className={cx(
      'inline-flex w-max shrink-0 flex-col gap-[2px] whitespace-nowrap font-bold leading-none',
      previous
        ? 'text-[14px] opacity-[0.66] min-[1400px]:text-[16px] min-[1920px]:text-[20px]'
        : 'text-[20px] min-[1400px]:text-[24px] min-[1920px]:text-[28px] min-[2220px]:text-[32px]',
    )}>
      <span className="text-[var(--shapeships-pastel-red)]">{damage}</span>
      <span className="text-[var(--shapeships-pastel-green)]">{healing}</span>
    </span>
  );
}

function focusStatBreakdown(event: KeyboardEvent<HTMLElement>) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    document.getElementById('board-stat-breakdown')?.focus();
  }
}

function CurrentCombatTrigger({
  card,
  metrics,
  align,
  hoverKey,
  hover,
}: {
  card: BoardCombatBreakdownVm;
  metrics: ReturnType<typeof getAffectedHealthMetrics>;
  align: 'left' | 'right';
  hoverKey: BoardStatHoverKey;
  hover: BoardStatHoverController;
}) {
  const trackable = Boolean(card.damage.section || card.healing.section);
  const damage = formatBoardStatMetric(metrics.damage?.current, 'current');
  const healing = formatBoardStatMetric(metrics.healing?.current, 'current');
  return (
    <button
      type="button"
      disabled={!trackable}
      aria-label={`${card.damage.label}: ${damage}; ${card.healing.label}: ${healing}. ${card.heading}. Down arrow to inspect.`}
      aria-controls={trackable ? 'board-stat-breakdown' : undefined}
      aria-expanded={trackable ? hover.state.activeKey === hoverKey : undefined}
      className={cx(
        'inline-flex w-max shrink-0 rounded-[4px] bg-transparent p-0 cursor-default',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white',
        align === 'right' ? 'text-right' : 'text-left',
      )}
      onMouseEnter={trackable ? (event) => hover.onEnter(hoverKey, event.currentTarget) : undefined}
      onMouseLeave={trackable ? () => hover.onLeave(hoverKey) : undefined}
      onFocus={trackable ? (event) => hover.onFocus(hoverKey, event.currentTarget) : undefined}
      onBlur={trackable ? () => hover.onBlur(hoverKey) : undefined}
      onKeyDown={trackable ? focusStatBreakdown : undefined}
    >
      <CombatValues damage={damage} healing={healing} />
    </button>
  );
}

function HealthTrigger({
  health,
  previous,
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
  previous: BoardCombatBreakdownVm | null;
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
  const isRight = align === 'right';
  const deltaText = netDelta > 0 ? `+${netDelta}` : netDelta === 0 ? '±0' : `−${Math.abs(netDelta)}`;
  const previousValues = (
    <span className={cx('row-start-1 w-max', isRight ? 'col-start-1 mr-[12px] justify-self-end' : 'col-start-2 ml-[12px] justify-self-start')}>
      <CombatValues damage={previous?.damage.totalText ?? '0'} healing={previous?.healing.totalText ?? '0'} previous />
    </span>
  );

  return (
    <button
      type="button"
      disabled={!hoverTrackable}
      aria-label={ariaLabel}
      aria-controls={hoverTrackable ? 'board-stat-breakdown' : undefined}
      aria-expanded={hoverTrackable ? isActive : undefined}
      className={cx(
        'inline-grid w-full items-center gap-x-0 rounded-[4px] bg-transparent p-0 font-bold text-inherit cursor-default',
        isRight ? 'grid-cols-[0px_var(--ss-health-number-width)]' : 'grid-cols-[var(--ss-health-number-width)_0px]',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white',
        isRight ? 'text-right' : 'text-left',
      )}
      onMouseEnter={hoverTrackable ? (event) => onHoverEnter(hoverKey, event.currentTarget) : undefined}
      onMouseLeave={hoverTrackable ? () => onHoverLeave(hoverKey) : undefined}
      onFocus={hoverTrackable ? (event) => onFocus(hoverKey, event.currentTarget) : undefined}
      onBlur={hoverTrackable ? () => onBlur(hoverKey) : undefined}
      onKeyDown={hoverTrackable ? focusStatBreakdown : undefined}
    >
      {isRight ? previousValues : null}
      <span className={cx(
        'row-start-1 w-[var(--ss-health-number-width)] min-w-[var(--ss-health-number-width)] overflow-visible whitespace-nowrap text-center text-[30px] leading-none text-white min-[1400px]:text-[40px] min-[1920px]:text-[64px]',
        isRight ? 'col-start-2' : 'col-start-1',
      )}>
        {health}
      </span>
      <span
        className={cx('row-start-2 w-[var(--ss-health-number-width)] min-w-[var(--ss-health-number-width)] min-h-[1em] justify-self-center overflow-visible whitespace-nowrap text-center text-[16px] leading-none min-[1400px]:text-[24px] min-[1920px]:text-[28px]', isRight ? 'col-start-2' : 'col-start-1')}
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
      {!isRight ? previousValues : null}
    </button>
  );
}

export function BoardStage({
  desktopHealthPresentation,
  desktopDicePresentation,
  vm,
  hudVm,
  thisTurn,
  presentedThisTurnStats,
  gameStats,
  viewer,
  matchupIntro,
  actions,
  phaseKey,
  winStreak,
}: BoardStageProps) {
  const isBattleReveal = phaseKey === 'battle.reveal';
  const fleetHover = useFleetShipHover();
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const barRegionRef = useRef<HTMLDivElement | null>(null);
  const statHover = useBoardStatHover({ boardRootRef, barRegionRef });
  const myBonusAnchorRef = useRef<HTMLDivElement | null>(null);
  const opponentBonusPrimaryAnchorRef = useRef<HTMLDivElement | null>(null);
  const opponentBonusJoiningAnchorRef = useRef<HTMLDivElement | null>(null);
  const axisLength = useDesktopHealthBarAxisLength(barRegionRef);
  const legendLabels = useDesktopHealthBarLegend(desktopHealthPresentation, axisLength);
  const displayedMyHealth = Math.round(desktopHealthPresentation?.numbers.left ?? (vm.mode === 'board' ? vm.myHealth : 25));
  const displayedOpponentHealth = Math.round(desktopHealthPresentation?.numbers.right ?? (vm.mode === 'board' ? vm.opponentHealth : 25));
  const leftRevealPulse = usePresentedFleetRevealPulse(
    vm.mode === 'board' ? vm.presentedMyRevealBlurSeq ?? 0 : null
  );
  const rightRevealPulse = usePresentedFleetRevealPulse(
    vm.mode === 'board' ? vm.presentedOpponentRevealBlurSeq : null
  );

  // Choose species mode
  if (vm.mode === 'choose_species') {
    return (
      <BoardStageFrame
        boardRootRef={boardRootRef}
        barRegionRef={barRegionRef}
        hudVm={hudVm}
        desktopDicePresentation={desktopDicePresentation}
        isChoosingSpecies
      >
        <div className="col-span-3 row-start-2 min-h-0 min-w-0">
          <ChooseSpeciesStage
            vm={vm}
            onSelectSpecies={actions.onSelectSpecies}
            onSelectBotSpecies={actions.onSelectBotSpecies}
            onConfirmSpecies={actions.onConfirmSpecies}
            onCopyGameUrl={actions.onCopyGameUrl}
          />
        </div>
      </BoardStageFrame>
    );
  }

  const mySpeciesKey = toSpeciesKey(vm.mySpeciesId);
  const opponentSpeciesKey = toSpeciesKey(vm.opponentSpeciesId);
  const myOrdinaryCentaurBonusLines =
    mySpeciesKey === 'centaur' ? vm.myBonusLines - vm.myBonusLinesOnEven : 0;
  const opponentOrdinaryCentaurBonusLines =
    opponentSpeciesKey === 'centaur'
      ? vm.opponentBonusLines - vm.opponentBonusLinesOnEven
      : 0;
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
  const capturedDelta = desktopHealthPresentation?.delta;
  const showDeltas = capturedDelta ? capturedDelta.visible : healthBreakdown.deltaVisible;
  const shouldAnimateDeltas = capturedDelta?.visible === true;
  const myChangeText = capturedDelta
    ? (capturedDelta.visible ? formatHealthChange(capturedDelta.left) : 'pending')
    : healthBreakdown.my?.changeText ?? 'unavailable';
  const opponentChangeText = capturedDelta
    ? (capturedDelta.visible ? formatHealthChange(capturedDelta.right) : 'pending')
    : healthBreakdown.opponent?.changeText ?? 'unavailable';
  const myDeltaKey = !showDeltas
    ? 'my:hidden'
    : shouldAnimateDeltas
      ? `my:resolution:${capturedDelta?.key}`
      : 'my:stable';
  const opponentDeltaKey = !showDeltas
    ? 'opp:hidden'
    : shouldAnimateDeltas
      ? `opp:resolution:${capturedDelta?.key}`
      : 'opp:stable';
  const labels = getHealthContributionLabels(viewer, gameStats);
  const myCurrentMetrics = getAffectedHealthMetrics(presentedThisTurnStats, 'my');
  const opponentCurrentMetrics = getAffectedHealthMetrics(presentedThisTurnStats, 'opponent');
  const myCurrentBreakdown = buildCurrentBoardCombatBreakdown({
    presentation: presentedThisTurnStats, side: 'my',
    damageLabel: labels.opponentDamage, healingLabel: labels.viewerHealing,
  });
  const opponentCurrentBreakdown = buildCurrentBoardCombatBreakdown({
    presentation: presentedThisTurnStats, side: 'opponent',
    damageLabel: labels.viewerDamage, healingLabel: labels.opponentHealing,
  });
  const myResolvedBreakdown = buildResolvedBoardCombatBreakdown({ card: healthBreakdown.my, thisTurn, side: 'my' });
  const opponentResolvedBreakdown = buildResolvedBoardCombatBreakdown({ card: healthBreakdown.opponent, thisTurn, side: 'opponent' });
  const myBonusClusterHasVisibleContent =
    myOrdinaryCentaurBonusLines !== 0 || myDisplayedBonusLines !== 0 || vm.myJoiningBonusLines > 0;
  const opponentBonusClusterHasVisibleContent =
    opponentOrdinaryCentaurBonusLines !== 0 || opponentDisplayedBonusLines !== 0 || vm.opponentJoiningBonusLines > 0;
  const myBonusHoverTrackable =
    vm.showTurnStartEconomyPresentation &&
    (myBonusClusterHasVisibleContent || vm.myBonusBreakdownRows.length > 0);
  const opponentBonusHoverTrackable =
    vm.showTurnStartEconomyPresentation &&
    (opponentBonusClusterHasVisibleContent ||
      vm.opponentBonusBreakdownRows.length > 0 ||
      shouldShowWinStreakBonusDetail(winStreak));
  const opponentBonusAnchorRef =
    vm.opponentJoiningBonusLines > 0 ? opponentBonusJoiningAnchorRef : opponentBonusPrimaryAnchorRef;
  type ActiveStatHover = {
    side: 'left' | 'right';
    content: BoardStatBreakdownHoverCardContent;
  };
  const statHoverContentByKey: Partial<Record<BoardStatHoverKey, ActiveStatHover>> = {
    ...(myResolvedBreakdown ? {
      'my-health': { side: 'left' as const, content: { kind: 'combat' as const, card: myResolvedBreakdown } },
    } : {}),
    ...(opponentResolvedBreakdown ? {
      'opponent-health': { side: 'right' as const, content: { kind: 'combat' as const, card: opponentResolvedBreakdown } },
    } : {}),
    'my-current': { side: 'left', content: { kind: 'combat', card: myCurrentBreakdown } },
    'opponent-current': { side: 'right', content: { kind: 'combat', card: opponentCurrentBreakdown } },
    'my-bonus': {
      side: 'left',
      content: { kind: 'breakdown', rows: vm.myBonusBreakdownRows },
    },
    'opponent-bonus': {
      side: 'right',
      content: shouldShowWinStreakBonusDetail(winStreak)
        ? {
            kind: 'win_streak',
            count: winStreak.appliedBonus.count,
            rows: withoutWinStreakBreakdownRow(vm.opponentBonusBreakdownRows),
          }
        : { kind: 'breakdown', rows: vm.opponentBonusBreakdownRows },
    },
  };
  const activeStatHover =
    statHover.presentState.activeKey
      ? statHoverContentByKey[statHover.presentState.activeKey]
      : null;
  const shouldRenderActiveStatHover = activeStatHover?.content.kind === 'combat'
    ? (statHover.presentState.activeKey?.endsWith('-health') ||
      Boolean(activeStatHover.content.card.damage.section || activeStatHover.content.card.healing.section))
    : activeStatHover?.content.kind === 'win_streak'
      ? true : (activeStatHover?.content.rows.length ?? 0) > 0;
  // Board mode
  return (
    <BoardStageFrame
      boardRootRef={boardRootRef}
      barRegionRef={barRegionRef}
      hudVm={hudVm}
      desktopDicePresentation={desktopDicePresentation}
      matchupIntro={matchupIntro}
      healthBars={desktopHealthPresentation ? (
        <HealthBarPair orientation="desktop" axisLength={axisLength} scale={desktopHealthPresentation.scale}
          left={desktopHealthPresentation.left} right={desktopHealthPresentation.right}
          legendLabels={legendLabels}
          leftLabel={viewer.isSpectator ? viewer.p1Name : 'Your health'}
          rightLabel={viewer.isSpectator ? viewer.p2Name : 'Opponent health'} />
      ) : null}
      currentStatsContent={
        <>
          <div className="absolute bottom-0 right-[calc(50%+64px)] min-[1920px]:right-[calc(50%+80px)] pb-0 min-[1920px]:pb-[20px]" data-name="P1 Current Contributions">
            <CurrentCombatTrigger card={myCurrentBreakdown} metrics={myCurrentMetrics} align="right" hoverKey="my-current" hover={statHover} />
          </div>
          <div className="absolute bottom-0 left-[calc(50%+64px)] min-[1920px]:left-[calc(50%+80px)] pb-0 min-[1920px]:pb-[20px]" data-name="P2 Current Contributions">
            <CurrentCombatTrigger card={opponentCurrentBreakdown} metrics={opponentCurrentMetrics} align="left" hoverKey="opponent-current" hover={statHover} />
          </div>
        </>
      }
      healthContent={
        <div className="relative flex w-full shrink-0 items-start justify-center gap-0 min-[120rem]:gap-[4px] [--ss-health-number-width:64px] xl:[--ss-health-number-width:70px] 2xl:[--ss-health-number-width:80px] min-[120rem]:[--ss-health-number-width:100px]" data-name="Health Wrapper">
          <div className="relative flex w-[var(--ss-health-number-width)] shrink-0 flex-col items-end text-right" data-name="P1 Health Group">
            <HealthTrigger
              health={displayedMyHealth}
              previous={myResolvedBreakdown}
              netDelta={capturedDelta?.left ?? vm.myLastTurnNet}
              showDelta={showDeltas}
              deltaKey={myDeltaKey}
              animateDelta={shouldAnimateDeltas}
              align="right"
              hoverKey="my-health"
              hoverTrackable={healthBreakdown.hoverEligible}
              ariaLabel={`Health ${displayedMyHealth}, maximum ${desktopHealthPresentation?.scale.leftCap.value ?? 'unknown'}, change ${myChangeText}. ${myResolvedBreakdown ? `${myResolvedBreakdown.heading}: ${myResolvedBreakdown.damage.label} ${myResolvedBreakdown.damage.totalText}, ${myResolvedBreakdown.healing.label} ${myResolvedBreakdown.healing.totalText}. Down arrow to inspect.` : 'Resolved breakdown unavailable.'}`}
              isActive={statHover.state.activeKey === 'my-health'}
              onHoverEnter={statHover.onEnter}
              onHoverLeave={statHover.onLeave}
              onFocus={statHover.onFocus}
              onBlur={statHover.onBlur}
            />
          </div>
          <div className="relative flex w-[var(--ss-health-number-width)] shrink-0 flex-col items-start text-left" data-name="P2 Health Group">
            <HealthTrigger
              health={displayedOpponentHealth}
              previous={opponentResolvedBreakdown}
              netDelta={capturedDelta?.right ?? vm.opponentLastTurnNet}
              showDelta={showDeltas}
              deltaKey={opponentDeltaKey}
              animateDelta={shouldAnimateDeltas}
              align="left"
              hoverKey="opponent-health"
              hoverTrackable={healthBreakdown.hoverEligible}
              ariaLabel={`Health ${displayedOpponentHealth}, maximum ${desktopHealthPresentation?.scale.rightCap.value ?? 'unknown'}, change ${opponentChangeText}. ${opponentResolvedBreakdown ? `${opponentResolvedBreakdown.heading}: ${opponentResolvedBreakdown.damage.label} ${opponentResolvedBreakdown.damage.totalText}, ${opponentResolvedBreakdown.healing.label} ${opponentResolvedBreakdown.healing.totalText}. Down arrow to inspect.` : 'Resolved breakdown unavailable.'}`}
              isActive={statHover.state.activeKey === 'opponent-health'}
              onHoverEnter={statHover.onEnter}
              onHoverLeave={statHover.onLeave}
              onFocus={statHover.onFocus}
              onBlur={statHover.onBlur}
            />
          </div>
        </div>
      }
      statsContent={
        <>
          {/* Keep real rows and yielding spacers in the same flex column. */}
          {/* Row envelopes stay mounted; presentation gates still withhold their contents. */}
          {/* Saved Lines */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full text-[11px] leading-[normal] [--ss-metric-label-lines:1] min-h-[calc(var(--ss-metric-value-height)+1lh)]" data-name="Saved Lines Group">
            {vm.showTurnStartEconomyPresentation ? (<>
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
              className="font-normal leading-[normal] relative shrink-0 text-[11px] min-[1400px]:text-[12px] text-center text-white w-[64px] min-[768px]:max-[1599px]:w-[56px]"
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
            </>) : null}
          </div>
          <div aria-hidden="true" className="min-h-0 basis-[4px] shrink min-[1400px]:basis-[6px] min-[1920px]:basis-[12px]" />

          {/* Bonus */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full text-[11px] leading-[normal] [--ss-metric-label-lines:2] min-h-[calc(var(--ss-metric-value-height)+2lh)]" data-name="Bonus Group">
            {vm.showTurnStartEconomyPresentation ? (<>
            <div className="content-stretch flex gap-[4px] items-center justify-end relative shrink-0 w-[100px] min-[768px]:max-[1599px]:w-[86px]" data-name="P1 Bonuses">
              <HoverAnchor
                hoverKey="my-bonus"
                isTrackable={myBonusHoverTrackable}
                anchorRef={myBonusAnchorRef}
                onHoverEnter={statHover.onEnter}
                onHoverLeave={statHover.onLeave}
                onFocus={statHover.onFocus}
                onBlur={statHover.onBlur}
                className="flex gap-[4px] items-center justify-end w-max shrink-0"
              >
                {myOrdinaryCentaurBonusLines !== 0 ? (
                  <div ref={myBonusAnchorRef} className="shrink-0">
                    <Metric
                      value={String(myOrdinaryCentaurBonusLines)}
                      label="LINES"
                      align="right"
                      toneClass="text-[var(--shapeships-pastel-blue)]"
                    />
                  </div>
                ) : null}
                <div ref={myOrdinaryCentaurBonusLines !== 0 ? undefined : myBonusAnchorRef} className="shrink-0">
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

            <div className="content-stretch flex items-center justify-center pb-0 pt-[4px] px-0 relative shrink-0">
              <p
                className="font-normal leading-[normal] relative shrink-0 text-[var(--shapeships-pastel-blue)] text-[11px] min-[1400px]:text-[12px] text-center w-[64px] min-[768px]:max-[1599px]:w-[56px]"
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
                onFocus={statHover.onFocus}
                onBlur={statHover.onBlur}
                className="flex gap-[4px] items-start w-max shrink-0"
              >
                {opponentOrdinaryCentaurBonusLines !== 0 ? (
                  <div ref={opponentBonusPrimaryAnchorRef} className="shrink-0">
                    <Metric
                      value={String(opponentOrdinaryCentaurBonusLines)}
                      label="LINES"
                      align="left"
                      toneClass="text-[var(--shapeships-pastel-blue)]"
                    />
                  </div>
                ) : null}
                <div ref={opponentOrdinaryCentaurBonusLines !== 0 ? undefined : opponentBonusPrimaryAnchorRef} className="shrink-0">
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
            </>) : null}
          </div>
          <div aria-hidden="true" className="min-h-0 basis-[4px] shrink min-[1400px]:basis-[6px] min-[1920px]:basis-[12px]" />

            <div className="hidden min-h-[18px] shrink-0 items-center justify-center gap-[10px] text-[var(--shapeships-pastel-purple)] min-[1400px]:flex" data-name="Fleet Value Group">
              {vm.showTurnStartEconomyPresentation && vm.presentedFleetValue ? (<>
              <span className="w-[86px] whitespace-nowrap text-right text-[18px] font-bold leading-none min-[1600px]:w-[100px]">{vm.presentedFleetValue.my}</span>
              <span className="w-[56px] text-center text-[12px] leading-none min-[1600px]:w-[64px]">Fleet</span>
              <span className="w-[86px] whitespace-nowrap text-left text-[18px] font-bold leading-none min-[1600px]:w-[100px]">{vm.presentedFleetValue.opponent}</span>
              </>) : null}
            </div>
        </>
      }
    >
      <div className="col-start-1 row-start-2 flex min-h-0 min-w-0">
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
      </div>

      <div className="col-start-3 row-start-2 flex min-h-0 min-w-0">
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
      </div>

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
          onPointerEnter={() => statHover.onCardEnter(statHover.presentState.activeKey!)}
          onPointerLeave={() => statHover.onCardLeave(statHover.presentState.activeKey!)}
          onFocus={() => statHover.onCardFocus(statHover.presentState.activeKey!)}
          onBlur={() => statHover.onCardBlur(statHover.presentState.activeKey!)}
        />
      ) : null}
    </BoardStageFrame>
  );
}
