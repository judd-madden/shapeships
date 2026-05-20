/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  BoardViewModel,
  GameSessionActions,
} from '../../client/useGameSession';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';
import { FleetArea, toSpeciesKey } from './boardStage/FleetArea';
import { FleetShipHoverCard } from './boardStage/FleetShipHoverCard';
import { useFleetShipHover } from './boardStage/useFleetShipHover';
import { BoardStatBreakdownHoverCard } from './boardStage/BoardStatBreakdownHoverCard';
import { useBoardStatHover, type BoardStatHoverKey } from './boardStage/useBoardStatHover';
import { usePresentedFleetRevealPulse } from './boardStage/usePresentedFleetRevealPulse';

interface BoardStageProps {
  vm: BoardViewModel;
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
        className="font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px] w-[50px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {value}
      </p>

      {hasLabel ? (
        <p
          className={cx(
            "font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[11px] text-nowrap uppercase",
            isRight && 'text-right'
          )}
          style={{ fontVariationSettings: "'wdth' 100" }}
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

function TripletStatValue({
  value,
  align,
  hoverKey,
  hoverTrackable,
  onHoverEnter,
  onHoverLeave,
}: {
  value: string;
  align: 'left' | 'right';
  hoverKey: BoardStatHoverKey;
  hoverTrackable: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
}) {
  const isRight = align === 'right';

  return (
    <div className={cx('flex w-[80px]', isRight ? 'justify-end text-right' : 'justify-start text-left')}>
      <HoverAnchor
        hoverKey={hoverKey}
        isTrackable={hoverTrackable}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        className="inline-block"
      >
        <p
          className={cx(
            "font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px]",
            isRight && 'text-right'
          )}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {value}
        </p>
      </HoverAnchor>
    </div>
  );
}

function StatTripletRow({
  left,
  centerLabel,
  right,
  toneClass,
  className,
  leftHoverKey,
  leftHoverTrackable = false,
  rightHoverKey,
  rightHoverTrackable = false,
  onHoverEnter,
  onHoverLeave,
}: {
  left: string;
  centerLabel: string;
  right: string;
  toneClass?: string;
  className?: string;
  leftHoverKey: BoardStatHoverKey;
  leftHoverTrackable?: boolean;
  rightHoverKey: BoardStatHoverKey;
  rightHoverTrackable?: boolean;
  onHoverEnter: (key: BoardStatHoverKey, anchorEl: HTMLElement) => void;
  onHoverLeave: (key: BoardStatHoverKey) => void;
}) {
  return (
    <div className={cx('content-stretch flex gap-[10px] items-center justify-center relative shrink-0', className, toneClass)}>
      <TripletStatValue
        value={left}
        align="right"
        hoverKey={leftHoverKey}
        hoverTrackable={leftHoverTrackable}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
      <p
        className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[14px] text-center w-[64px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {centerLabel}
      </p>
      <TripletStatValue
        value={right}
        align="left"
        hoverKey={rightHoverKey}
        hoverTrackable={rightHoverTrackable}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
    </div>
  );
}

export function BoardStage({ vm, actions, phaseKey }: BoardStageProps) {
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

  // Hide deltas on turn 1 only
  const showDeltas = vm.turnNumber > 1 || vm.healthDeltaPresentationKey != null;
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
  const myDamageHoverTrackable = true;
  const opponentDamageHoverTrackable = true;
  const myHealingHoverTrackable = true;
  const opponentHealingHoverTrackable = true;
  const myBonusClusterHasVisibleContent =
    myDisplayedBonusLines !== 0 || vm.myJoiningBonusLines > 0;
  const opponentBonusClusterHasVisibleContent =
    opponentDisplayedBonusLines !== 0 || vm.opponentJoiningBonusLines > 0;
  const myBonusHoverTrackable = myBonusClusterHasVisibleContent;
  const opponentBonusHoverTrackable = opponentBonusClusterHasVisibleContent;
  const opponentBonusAnchorRef =
    vm.opponentJoiningBonusLines > 0 ? opponentBonusJoiningAnchorRef : opponentBonusPrimaryAnchorRef;
  const statHoverRowsByKey: Record<BoardStatHoverKey, { rows: typeof vm.myLastDamageBreakdownRows; side: 'left' | 'right' }> = {
    'my-last-damage': { rows: vm.myLastDamageBreakdownRows, side: 'left' },
    'opponent-last-damage': { rows: vm.opponentLastDamageBreakdownRows, side: 'right' },
    'my-last-healing': { rows: vm.myLastHealingBreakdownRows, side: 'left' },
    'opponent-last-healing': { rows: vm.opponentLastHealingBreakdownRows, side: 'right' },
    'my-bonus': { rows: vm.myBonusBreakdownRows, side: 'left' },
    'opponent-bonus': { rows: vm.opponentBonusBreakdownRows, side: 'right' },
  };
  const activeStatHover =
    statHover.state.activeKey ? statHoverRowsByKey[statHover.state.activeKey] : null;

  // Board mode
  return (
    <div
      className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full"
      data-name="Board Stage"
      onMouseDown={actions.onBoardBackgroundMouseDown}
    >
      <FleetArea 
        title="MY FLEET" 
        ships={vm.myFleet} 
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
        onFleetHoverEnter={fleetHover.onEnter}
        onFleetHoverLeave={fleetHover.onLeave}
        turnPulse={leftRevealPulse}
      />

      <div
        className="content-stretch flex flex-col h-full items-center justify-between relative shrink-0 w-[230px] cursor-default select-none"
        data-name="Health and Stats"
      >
        {/* Health */}
        <div
          className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full"
          data-name="Health Wrapper"
        >
          <div
            className="content-stretch flex flex-col font-['Roboto'] font-bold gap-px items-end relative shrink-0 text-right w-[100px]"
            data-name="P1 Health Group"
          >
            <p
              className="leading-[64px] relative shrink-0 text-[64px] text-white w-full"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {displayedMyHealth}
            </p>

            {/* Delta (server-authoritative) */}
            <p
              className="font-['Roboto'] font-semibold leading-[28px] relative shrink-0 text-[28px] w-full text-right"
              style={{
                fontVariationSettings: "'wdth' 100",
                color: vm.myLastTurnNet > 0 
                  ? 'var(--shapeships-pastel-green)' 
                  : vm.myLastTurnNet < 0 
                  ? 'var(--shapeships-pastel-red)' 
                  : 'var(--shapeships-grey-50)',
                opacity: showDeltas ? 1 : 0,
                pointerEvents: showDeltas ? 'auto' : 'none',
              }}
            >
              <span
                key={myDeltaKey}
                className={showDeltas && shouldAnimateDeltas ? 'ss-health-delta-pop-in' : undefined}
              >
                {showDeltas ? (vm.myLastTurnNet > 0 ? `+${vm.myLastTurnNet}` : vm.myLastTurnNet === 0 ? '±0' : vm.myLastTurnNet) : ''}
              </span>
            </p>
          </div>

          <div
            className="content-stretch flex items-center justify-center pb-0 pt-[22px] px-0 relative shrink-0"
            data-name="Health Label"
          >
            <div className="flex flex-col items-center justify-start w-[64px] text-center">
              <p
                className="font-['Roboto'] font-normal leading-[1.25] relative shrink-0 text-white text-[15px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Health
              </p>

              {/* Max Health (UI placeholder) */}
              <p
                className="font-['Roboto'] font-semibold leading-[13px] relative shrink-0 text-[13px]"
                style={{
                  fontVariationSettings: "'wdth' 100",
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                35
              </p>
            </div>
          </div>

          <div
            className="content-stretch flex flex-col font-['Roboto'] font-bold items-start relative shrink-0 w-[100px]"
            data-name="P2 Health Group"
          >
            <p
              className="leading-[64px] relative shrink-0 text-[64px] text-white w-[100px] text-left"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {displayedOpponentHealth}
            </p>

            {/* Delta (server-authoritative) */}
            <p
              className="font-['Roboto'] font-semibold leading-[28px] relative shrink-0 text-[28px] w-[100px] text-left"
              style={{
                fontVariationSettings: "'wdth' 100",
                color: vm.opponentLastTurnNet > 0 
                  ? 'var(--shapeships-pastel-green)' 
                  : vm.opponentLastTurnNet < 0 
                  ? 'var(--shapeships-pastel-red)' 
                  : 'var(--shapeships-grey-50)',
                opacity: showDeltas ? 1 : 0,
                pointerEvents: showDeltas ? 'auto' : 'none',
              }}
            >
              <span
                key={opponentDeltaKey}
                className={showDeltas && shouldAnimateDeltas ? 'ss-health-delta-pop-in' : undefined}
              >
                {showDeltas ? (vm.opponentLastTurnNet > 0 ? `+${vm.opponentLastTurnNet}` : vm.opponentLastTurnNet === 0 ? '±0' : vm.opponentLastTurnNet) : ''}
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0 w-full" data-name="Stats Wrapper">
          {/* Saved Lines */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Saved Lines Group">
            {/* P1 */}
            <div className="content-stretch flex items-start justify-end relative shrink-0 w-[100px]" data-name="P1 Saved Wrapper">
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
              className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[15px] text-center text-white w-[64px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Saved
              <br aria-hidden="true" />
              Lines
            </p>
          
            {/* P2 */}
            <div className="content-stretch flex items-start relative shrink-0 w-[100px]" data-name="P2 Saved Wrapper">
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

          <StatTripletRow
            left={String(vm.myLastTurnDamage ?? 0)}
            centerLabel="Last Damage"
            right={String(vm.opponentLastTurnDamage ?? 0)}
            toneClass="text-[#ff8282]"
            leftHoverKey="my-last-damage"
            leftHoverTrackable={myDamageHoverTrackable}
            rightHoverKey="opponent-last-damage"
            rightHoverTrackable={opponentDamageHoverTrackable}
            onHoverEnter={statHover.onEnter}
            onHoverLeave={statHover.onLeave}
          />
          <StatTripletRow
            left={String(vm.myLastTurnHeal ?? 0)}
            centerLabel="Last Healing"
            right={String(vm.opponentLastTurnHeal ?? 0)}
            toneClass="text-[#9cff84]"
            leftHoverKey="my-last-healing"
            leftHoverTrackable={myHealingHoverTrackable}
            rightHoverKey="opponent-last-healing"
            rightHoverTrackable={opponentHealingHoverTrackable}
            onHoverEnter={statHover.onEnter}
            onHoverLeave={statHover.onLeave}
          />

          {/* Bonus */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Bonus Group">
            <div className="content-stretch flex gap-[4px] items-center justify-end relative shrink-0 w-[100px]" data-name="P1 Bonuses">
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
                    toneClass="text-[#62fff6]"
                  />
                </div>
                {vm.myJoiningBonusLines > 0 ? (
                  <Metric
                    value={String(vm.myJoiningBonusLines)}
                    label="JOINING"
                    label2="LINES"
                    align="right"
                    toneClass="text-[#62fff6]"
                  />
                ) : null}
              </HoverAnchor>
            </div>

            <div className="content-stretch flex items-center justify-center pb-0 pt-[8px] px-0 relative shrink-0">
              <p
                className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[#62fff6] text-[15px] text-center w-[64px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Bonus
              </p>
            </div>

            <div className="content-stretch flex gap-[4px] items-start relative shrink-0 w-[100px]" data-name="P2 Bonuses">
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
                    toneClass="text-[#62fff6]"
                  />
                </div>
                {vm.opponentJoiningBonusLines > 0 ? (
                  <div ref={opponentBonusJoiningAnchorRef} className="shrink-0">
                    <Metric
                      value={String(vm.opponentJoiningBonusLines)}
                      label="JOINING"
                      label2="LINES"
                      align="left"
                      toneClass="text-[#62fff6]"
                    />
                  </div>
                ) : null}
              </HoverAnchor>
            </div>
          </div>
        </div>
      </div>

      <FleetArea 
        title="OPPONENT FLEET" 
        ships={vm.opponentFleet} 
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
        onFleetHoverEnter={fleetHover.onEnter}
        onFleetHoverLeave={fleetHover.onLeave}
        turnPulse={rightRevealPulse}
      />

      {fleetHover.state.activeShipId && fleetHover.state.anchorRect ? (
        <FleetShipHoverCard
          shipId={fleetHover.state.activeShipId}
          anchorRect={fleetHover.state.anchorRect}
        />
      ) : null}

      {activeStatHover && statHover.state.anchorRect && activeStatHover.rows.length > 0 ? (
        <BoardStatBreakdownHoverCard
          anchorRect={statHover.state.anchorRect}
          side={activeStatHover.side}
          rows={activeStatHover.rows}
        />
      ) : null}
    </div>
  );
}
