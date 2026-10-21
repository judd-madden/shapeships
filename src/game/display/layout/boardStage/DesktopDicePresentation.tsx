import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dice } from '../../../../components/ui/primitives';
import { Cube } from '../../../../graphics/ancient/Cube';
import type { LeftRailViewModel } from '../../../client/useGameSession';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';

export interface DesktopDicePresentationProps extends Pick<
  LeftRailViewModel,
  'diceValue' | 'diceAnimateKey' | 'diceManipulationSlots'
> {
  firstTurnBuildHelperEligible?: boolean;
  firstTurnBuildHelperDismissSignal?: number;
  onFirstTurnBuildHelperDismiss?: () => void;
  guidanceSuppressed?: boolean;
}

const FIRST_TURN_BUILD_HELPER_SHOW_DELAY_MS = 500;
const FIRST_TURN_BUILD_HELPER_FADE_MS = 150;
const VIEWPORT_INSET = 12;

function DesktopDiceHelper({ slot }: {
  slot: LeftRailViewModel['diceManipulationSlots']['left'];
}) {
  if (!slot) return null;

  const definition = slot.sourceShipDefId === 'CUB'
    ? null
    : getShipDefinitionUI(slot.sourceShipDefId);
  const ShipGraphic = definition
    ? resolveShipGraphic(definition, { context: 'default' })?.component
    : null;
  const values = Array.isArray(slot.diceValues) ? slot.diceValues : [];
  const isChronoswarm = slot.sourceShipDefId === 'CHR';
  const sourceGraphic = slot.sourceShipDefId === 'CUB' ? (
    <Cube
      className="size-[var(--ss-helper-source-size)]"
      highlighted={slot.highlighted === true}
    />
  ) : ShipGraphic ? (
    <ShipGraphic className="size-[var(--ss-helper-source-size)]" />
  ) : null;

  const renderDie = (index: number) => {
    const value = values[index];
    if (value === undefined) return null;

    return (
      <Dice
        key={`${slot.sourceShipDefId}-${index}`}
        value={value}
        animateKey={isChronoswarm || slot.sourceShipDefId === 'CUB' ? slot.animateKey : undefined}
        className="!size-[var(--ss-helper-die-size)]"
        enableRotate={false}
      />
    );
  };

  if (isChronoswarm) {
    return (
      <div className="grid grid-cols-[repeat(2,var(--ss-helper-die-size))] grid-rows-[repeat(2,var(--ss-helper-die-size))] gap-[4px] place-items-center">
        <div className="col-start-1 row-start-1">{renderDie(0)}</div>
        <div className="col-start-2 row-start-1">{renderDie(1)}</div>
        <div className="col-start-1 row-start-2">{sourceGraphic}</div>
        <div className="col-start-2 row-start-2">{renderDie(2)}</div>
      </div>
    );
  }

  return (
    <div className="flex w-max flex-col items-center gap-[4px]">
      {values.length > 0 ? (
        <div className="flex items-center gap-[4px]">
          {values.map((_value, index) => renderDie(index))}
        </div>
      ) : slot.sourceShipDefId === 'KNO' ? (
        <div className="size-[var(--ss-helper-die-size)]" aria-hidden="true" />
      ) : null}
      {sourceGraphic}
    </div>
  );
}

export function DesktopDicePresentation({
  diceValue,
  diceAnimateKey,
  diceManipulationSlots,
  firstTurnBuildHelperEligible = false,
  firstTurnBuildHelperDismissSignal = 0,
  onFirstTurnBuildHelperDismiss,
  guidanceSuppressed = false,
}: DesktopDicePresentationProps) {
  const [isHelperMounted, setIsHelperMounted] = useState(false);
  const [isHelperVisible, setIsHelperVisible] = useState(false);
  const [helperPosition, setHelperPosition] = useState({ left: 0, top: 0, pointerTop: 50, onRight: true });
  const mainDieRef = useRef<HTMLDivElement | null>(null);
  const helperRef = useRef<HTMLDivElement | null>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const dismissTimeoutRef = useRef<number | null>(null);

  function clearShowTimeout() {
    if (showTimeoutRef.current !== null) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }

  function clearDismissTimeout() {
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }

  useEffect(() => () => {
    clearShowTimeout();
    clearDismissTimeout();
  }, []);

  useEffect(() => {
    if (firstTurnBuildHelperDismissSignal === 0) return;

    setIsHelperMounted(true);
    clearShowTimeout();
    clearDismissTimeout();
    setIsHelperVisible(false);
    dismissTimeoutRef.current = window.setTimeout(() => {
      dismissTimeoutRef.current = null;
      setIsHelperMounted(false);
    }, FIRST_TURN_BUILD_HELPER_FADE_MS);
  }, [firstTurnBuildHelperDismissSignal]);

  useEffect(() => {
    if (!firstTurnBuildHelperEligible) {
      clearShowTimeout();
      clearDismissTimeout();
      setIsHelperMounted(false);
      setIsHelperVisible(false);
      return;
    }
    if (firstTurnBuildHelperDismissSignal > 0) {
      clearShowTimeout();
      return;
    }

    clearShowTimeout();
    setIsHelperMounted(true);
    setIsHelperVisible(false);
    showTimeoutRef.current = window.setTimeout(() => {
      showTimeoutRef.current = null;
      setIsHelperVisible(true);
    }, FIRST_TURN_BUILD_HELPER_SHOW_DELAY_MS);
    return clearShowTimeout;
  }, [firstTurnBuildHelperEligible, firstTurnBuildHelperDismissSignal]);

  function measureHelperPosition() {
    const mainDie = mainDieRef.current;
    const helper = helperRef.current;
    if (!mainDie || !helper || guidanceSuppressed) return;

    const dieRect = mainDie.getBoundingClientRect();
    const cardRect = helper.getBoundingClientRect();
    const onRight = dieRect.right + VIEWPORT_INSET + cardRect.width <= window.innerWidth - VIEWPORT_INSET;
    const preferredLeft = onRight
      ? dieRect.right + VIEWPORT_INSET
      : dieRect.left - VIEWPORT_INSET - cardRect.width;
    const left = Math.max(VIEWPORT_INSET, Math.min(preferredLeft, window.innerWidth - VIEWPORT_INSET - cardRect.width));
    const dieCenterY = dieRect.top + dieRect.height / 2;
    const top = Math.max(VIEWPORT_INSET, Math.min(dieCenterY - 56, window.innerHeight - VIEWPORT_INSET - cardRect.height));
    const next = {
      left: left - dieRect.left,
      top: top - dieRect.top,
      pointerTop: Math.max(12, Math.min(dieCenterY - top - 6, cardRect.height - 24)),
      onRight,
    };
    setHelperPosition((current) =>
      current.left === next.left && current.top === next.top &&
      current.pointerTop === next.pointerTop && current.onRight === next.onRight
        ? current : next
    );
  }

  // Measure ordinary updates without coupling positioning to the appearance timer.
  useLayoutEffect(measureHelperPosition);
  useLayoutEffect(() => {
    if (!isHelperMounted) return;
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measureHelperPosition)
      : null;
    if (helperRef.current) observer?.observe(helperRef.current);
    if (mainDieRef.current) {
      observer?.observe(mainDieRef.current);
      const board = mainDieRef.current.closest('[data-name="Board Stage"]');
      if (board) observer?.observe(board);
    }
    window.addEventListener('resize', measureHelperPosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureHelperPosition);
    };
  }, [isHelperMounted, guidanceSuppressed]);

  const showGuidance = isHelperVisible && !guidanceSuppressed;

  return (
    <div
      className="pointer-events-none relative flex shrink-0 justify-center overflow-visible [--ss-main-die-size:64px] [--ss-helper-die-size:28px] [--ss-helper-source-size:24px] [--ss-dice-helper-gap:8px] min-[1400px]:[--ss-main-die-size:120px] min-[1400px]:[--ss-helper-die-size:44px] min-[1400px]:[--ss-helper-source-size:40px] min-[1400px]:[--ss-dice-helper-gap:10px] min-[1920px]:[--ss-main-die-size:148px] min-[1920px]:[--ss-helper-die-size:56px] min-[1920px]:[--ss-helper-source-size:52px] min-[1920px]:[--ss-dice-helper-gap:12px]"
      data-name="Desktop Dice Presentation"
    >
      {/* Helpers are out of flow: the main die and neighbouring rows never shift. */}
      <div ref={mainDieRef} className="relative size-[var(--ss-main-die-size)] shrink-0 overflow-visible">
        <Dice value={diceValue} animateKey={diceAnimateKey} className="!size-[var(--ss-main-die-size)]" />
        <div className="pointer-events-none absolute right-[calc(100%+var(--ss-dice-helper-gap))] top-1/2 w-max -translate-y-1/2">
          <DesktopDiceHelper slot={diceManipulationSlots.left} />
        </div>
        <div className="pointer-events-none absolute left-[calc(100%+var(--ss-dice-helper-gap))] top-1/2 w-max -translate-y-1/2">
          <DesktopDiceHelper slot={diceManipulationSlots.right} />
        </div>
        {isHelperMounted ? (
          <div
            className="absolute z-30"
            aria-hidden={!showGuidance}
            style={{
              left: helperPosition.left,
              top: helperPosition.top,
              opacity: showGuidance ? 1 : 0,
              visibility: guidanceSuppressed ? 'hidden' : undefined,
              pointerEvents: showGuidance ? 'auto' : 'none',
              transition: `opacity ${FIRST_TURN_BUILD_HELPER_FADE_MS}ms ease-out`,
            }}
          >
            <div
              ref={helperRef}
              role="button"
              tabIndex={showGuidance ? 0 : -1}
              className="relative flex w-max max-w-[min(290px,calc(100vw-24px))] flex-col gap-[12px] rounded-[10px] bg-[var(--shapeships-pastel-green)] pb-[20px] pl-[24px] pr-[24px] pt-[16px] text-left text-[var(--shapeships-black)]"
              onClick={onFirstTurnBuildHelperDismiss}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onFirstTurnBuildHelperDismiss?.();
                }
              }}
            >
              <div
                aria-hidden="true"
                className="absolute size-[12px] rotate-45 bg-[var(--shapeships-pastel-green)]"
                style={{ top: helperPosition.pointerTop, ...(helperPosition.onRight ? { left: -6 } : { right: -6 }) }}
              />
              <p className="text-[26px] font-black leading-[1.05]">The dice gives lines to both players.</p>
              <div className="flex flex-col gap-[12px]">
                <p className="text-[18px] font-normal leading-[1.2]">You start with <span className="font-bold">3 saved lines</span>.</p>
                <p className="text-[18px] font-normal leading-[1.2]">Spend lines to build ships. Unspent lines are saved.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
