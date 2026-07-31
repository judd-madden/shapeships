import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import type {
  AncientSolarDisplayEntry,
  LiveRowAncientSolarPowerId,
} from '../../../client/gameSession/types';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import {
  AnimatedBlackHole,
  AnimatedSiphon,
  AnimatedStarBirth,
  AnimatedSupernova,
  AnimatedVortex,
} from '../../../../graphics/ancient/animations';
import { Asteroid, Convert, Life } from '../../../../graphics/ancient/assets';
import {
  SolarLedgerClearAnimationWrapper,
  SolarPowerAnimationWrapper,
  useSolarPowerEntryAnimTokens,
} from '../../graphics/animation';
import { useFlipLayout } from '../../graphics/useFlipLayout';
import { AncientSimulacrumLedgerGraphic } from './AncientSimulacrumLedgerGraphic';
import { FitToBox } from './FitToBox';

const SOLAR_ROW_FLIP_DURATION_MS = 400;
const SOLAR_ROW_ANCESTOR_SCALE_EPSILON = 0.001;
const SOLAR_LEDGER_CLEAR_FALLBACK_MS = 600;
const IGNORED_FLIP_ANCESTOR_SCALE_CLASS_NAMES = ['ss-boardTurnPulse'] as const;

type SolarGraphic = ComponentType<{ className?: string }>;
type StandardSolarLedgerPowerId = Exclude<LiveRowAncientSolarPowerId, 'SSIM'>;

const SOLAR_GRAPHIC_BY_ID: Record<StandardSolarLedgerPowerId, SolarGraphic> = {
  SLIF: Life,
  SSTA: AnimatedStarBirth,
  SAST: Asteroid,
  SSUP: AnimatedSupernova,
  SCON: Convert,
  SSIP: AnimatedSiphon,
  SVOR: AnimatedVortex,
  SBLA: AnimatedBlackHole,
};

function buildSolarPresentationSignature(
  entries: readonly AncientSolarDisplayEntry[]
): string {
  return JSON.stringify(entries.map((entry) => [
    entry.displayKey,
    entry.solarPowerId,
    entry.effectCaption ?? null,
    entry.solarPowerId === 'SSIM'
      ? entry.simulacrumPresentation.copiedShipDefId
      : null,
    entry.solarPowerId === 'SSIM'
      ? entry.simulacrumPresentation.capturedStartOfBattleCharges ?? null
      : null,
    entry.solarPowerId === 'SSIM'
      ? entry.simulacrumPresentation.selectedNumber ?? null
      : null,
  ]));
}

export function AncientSolarLedgerRow({
  entries,
  compact = false,
  hasCopiedShipBand = false,
  isBattleReveal = false,
  onFleetHoverEnter,
  onFleetHoverLeave,
}: {
  entries: readonly AncientSolarDisplayEntry[];
  compact?: boolean;
  hasCopiedShipBand?: boolean;
  isBattleReveal?: boolean;
  onFleetHoverEnter?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onFleetHoverLeave?: (shipId: ShipDefId) => void;
}) {
  const [presentedEntries, setPresentedEntries] = useState<readonly AncientSolarDisplayEntry[]>(
    entries
  );
  const [activeClearCycle, setActiveClearCycle] = useState<number | null>(null);
  const previousIsBattleRevealRef = useRef(isBattleReveal);
  const latestIncomingEntriesRef = useRef(entries);
  const nextClearCycleRef = useRef(1);
  const activeClearCycleRef = useRef<number | null>(null);
  const clearFallbackTimeoutRef = useRef<number | null>(null);
  const activeHoveredEntryRef = useRef<{
    displayKey: string;
    solarPowerId: LiveRowAncientSolarPowerId;
  } | null>(null);
  const onFleetHoverLeaveRef = useRef(onFleetHoverLeave);

  latestIncomingEntriesRef.current = entries;
  onFleetHoverLeaveRef.current = onFleetHoverLeave;

  const incomingPresentationSignature = buildSolarPresentationSignature(entries);
  const presentedPresentationSignature = buildSolarPresentationSignature(presentedEntries);
  const isClearingAtBattleReveal = activeClearCycle !== null;

  const clearActiveHover = useCallback((displayKey?: string) => {
    const activeHoveredEntry = activeHoveredEntryRef.current;
    if (
      activeHoveredEntry === null ||
      (displayKey !== undefined && activeHoveredEntry.displayKey !== displayKey)
    ) {
      return;
    }

    activeHoveredEntryRef.current = null;
    onFleetHoverLeaveRef.current?.(activeHoveredEntry.solarPowerId);
  }, []);

  const completeClearCycle = useCallback((cycle: number) => {
    if (activeClearCycleRef.current !== cycle) {
      return;
    }

    activeClearCycleRef.current = null;

    if (clearFallbackTimeoutRef.current !== null) {
      window.clearTimeout(clearFallbackTimeoutRef.current);
      clearFallbackTimeoutRef.current = null;
    }

    setPresentedEntries([...latestIncomingEntriesRef.current]);
    setActiveClearCycle(null);
  }, []);

  useLayoutEffect(() => {
    const enteredReveal =
      previousIsBattleRevealRef.current === false && isBattleReveal === true;

    if (
      enteredReveal &&
      activeClearCycleRef.current === null &&
      presentedEntries.length > 0
    ) {
      const cycle = nextClearCycleRef.current++;
      activeClearCycleRef.current = cycle;
      setActiveClearCycle(cycle);
    } else if (
      activeClearCycleRef.current === null &&
      presentedPresentationSignature !== incomingPresentationSignature
    ) {
      setPresentedEntries([...latestIncomingEntriesRef.current]);
    }

    previousIsBattleRevealRef.current = isBattleReveal;
  }, [
    incomingPresentationSignature,
    isBattleReveal,
    presentedEntries.length,
    presentedPresentationSignature,
  ]);

  useEffect(() => {
    if (activeClearCycle === null) {
      return;
    }

    const cycle = activeClearCycle;
    clearFallbackTimeoutRef.current = window.setTimeout(() => {
      completeClearCycle(cycle);
    }, SOLAR_LEDGER_CLEAR_FALLBACK_MS);

    return () => {
      if (clearFallbackTimeoutRef.current !== null) {
        window.clearTimeout(clearFallbackTimeoutRef.current);
        clearFallbackTimeoutRef.current = null;
      }
    };
  }, [activeClearCycle, completeClearCycle]);

  const displayKeys = presentedEntries.map((entry) => entry.displayKey);

  useLayoutEffect(() => {
    if (isClearingAtBattleReveal) {
      clearActiveHover();
      return;
    }

    const activeHoveredEntry = activeHoveredEntryRef.current;
    if (
      activeHoveredEntry !== null &&
      !displayKeys.includes(activeHoveredEntry.displayKey)
    ) {
      clearActiveHover();
    }
  }, [clearActiveHover, displayKeys, isClearingAtBattleReveal]);

  useEffect(() => {
    return () => {
      clearActiveHover();
    };
  }, [clearActiveHover]);

  const layoutSignature = displayKeys.join('|');
  const itemLayoutSignatures = Object.fromEntries(
    presentedEntries.map((entry) => [
      entry.displayKey,
      entry.solarPowerId === 'SSIM'
        ? [
            entry.solarPowerId,
            entry.simulacrumPresentation.copiedShipDefId,
            entry.simulacrumPresentation.capturedStartOfBattleCharges ?? '',
            entry.simulacrumPresentation.selectedNumber ?? '',
          ].join(':')
        : `${entry.solarPowerId}:${entry.effectCaption ?? ''}`,
    ])
  );
  const entryAnimationTokens = useSolarPowerEntryAnimTokens(
    displayKeys,
    !isClearingAtBattleReveal
  );
  const getFlipRef = useFlipLayout(displayKeys, true, {
    durationMs: SOLAR_ROW_FLIP_DURATION_MS,
    easing: 'ease-in-out',
    layoutSignature,
    itemLayoutSignatures,
    skipSelfChangedItemForNextRun: false,
    skipWhenAncestorScaleChanged: true,
    ancestorScaleChangeEpsilon: SOLAR_ROW_ANCESTOR_SCALE_EPSILON,
    ignoredAncestorScaleClassNames: IGNORED_FLIP_ANCESTOR_SCALE_CLASS_NAMES,
  });

  const ledgerContents = presentedEntries.length > 0 ? (
    <SolarLedgerClearAnimationWrapper
      active={isClearingAtBattleReveal}
      onAnimationEnd={() => {
        if (activeClearCycle !== null) {
          completeClearCycle(activeClearCycle);
        }
      }}
    >
      <div className="inline-flex w-max flex-row items-center justify-center gap-[18px] sm:gap-[24px]">
        {presentedEntries.map((entry) => {
          return (
            <div
              key={entry.displayKey}
              ref={getFlipRef(entry.displayKey)}
              className="inline-flex shrink-0 flex-col items-center justify-center gap-[4px]"
              onMouseEnter={
                onFleetHoverEnter
                  ? (event) => {
                      activeHoveredEntryRef.current = {
                        displayKey: entry.displayKey,
                        solarPowerId: entry.solarPowerId,
                      };
                      onFleetHoverEnter(entry.solarPowerId, event.currentTarget);
                    }
                  : undefined
              }
              onMouseLeave={
                onFleetHoverLeave
                  ? () => {
                      clearActiveHover(entry.displayKey);
                    }
                  : undefined
              }
            >
              <SolarPowerAnimationWrapper
                solarPowerId={entry.solarPowerId}
                token={entryAnimationTokens[entry.displayKey]}
                clearing={isClearingAtBattleReveal}
              >
                {entry.solarPowerId === 'SSIM' ? (
                  <AncientSimulacrumLedgerGraphic
                    presentation={entry.simulacrumPresentation}
                  />
                ) : (() => {
                  const SolarGraphic = SOLAR_GRAPHIC_BY_ID[entry.solarPowerId];
                  return <SolarGraphic className="block shrink-0" />;
                })()}
              </SolarPowerAnimationWrapper>
              {entry.effectCaption !== undefined ? (
                <span className="pointer-events-none select-none text-center font-['Roboto'] text-[18px] font-bold leading-none text-white">
                  {entry.effectCaption}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </SolarLedgerClearAnimationWrapper>
  ) : null;

  if (compact) {
    return (
      <div
        className={hasCopiedShipBand
          ? 'h-[44px] w-full min-w-0 shrink-0 mb-[4px]'
          : 'h-[50px] w-full min-w-0 shrink-0 mb-[4px]'}
      >
        {ledgerContents ? (
          <FitToBox
            minScale={0.15}
            maxScale={1}
            className="h-full w-full"
            deferInnerResizeComputeMs={SOLAR_ROW_FLIP_DURATION_MS}
          >
            {ledgerContents}
          </FitToBox>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-[102px] w-max shrink-0 items-center justify-center">
      {ledgerContents}
    </div>
  );
}
