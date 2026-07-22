import type { ComponentType } from 'react';
import type {
  AncientSolarDisplayEntry,
  LiveRowAncientSolarPowerId,
} from '../../../client/gameSession/types';
import {
  AnimatedBlackHole,
  AnimatedSiphon,
  AnimatedStarBirth,
  AnimatedSupernova,
  AnimatedVortex,
} from '../../../../graphics/ancient/animations';
import { Asteroid, Convert, Life } from '../../../../graphics/ancient/assets';
import { useFlipLayout } from '../../graphics/useFlipLayout';
import { FitToBox } from './FitToBox';

const SOLAR_ROW_FLIP_DURATION_MS = 400;
const SOLAR_ROW_ANCESTOR_SCALE_EPSILON = 0.001;
const IGNORED_FLIP_ANCESTOR_SCALE_CLASS_NAMES = ['ss-boardTurnPulse'] as const;

type SolarGraphic = ComponentType<{ className?: string }>;

const SOLAR_GRAPHIC_BY_ID: Record<LiveRowAncientSolarPowerId, SolarGraphic> = {
  SLIF: Life,
  SSTA: AnimatedStarBirth,
  SAST: Asteroid,
  SSUP: AnimatedSupernova,
  SCON: Convert,
  SSIP: AnimatedSiphon,
  SVOR: AnimatedVortex,
  SBLA: AnimatedBlackHole,
};

export function AncientSolarLedgerRow({
  entries,
  compact = false,
}: {
  entries: AncientSolarDisplayEntry[];
  compact?: boolean;
}) {
  const displayKeys = entries.map((entry) => entry.displayKey);
  const layoutSignature = displayKeys.join('|');
  const itemLayoutSignatures = Object.fromEntries(
    entries.map((entry) => [entry.displayKey, entry.solarPowerId])
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

  return (
    <div className={compact
      ? 'h-[50px] w-full min-w-0 shrink-0'
      : 'h-[92px] w-full min-w-0 shrink-0'}>
      {entries.length > 0 ? (
        <FitToBox
          minScale={0.15}
          maxScale={1}
          className="h-full w-full"
          deferInnerResizeComputeMs={SOLAR_ROW_FLIP_DURATION_MS}
        >
          <div className="inline-flex w-max flex-row items-center justify-center gap-[18px]">
            {entries.map((entry) => {
              const SolarGraphic = SOLAR_GRAPHIC_BY_ID[entry.solarPowerId];
              return (
                <div
                  key={entry.displayKey}
                  ref={getFlipRef(entry.displayKey)}
                  className="inline-flex shrink-0 items-center justify-center"
                >
                  <SolarGraphic className="block shrink-0" />
                </div>
              );
            })}
          </div>
        </FitToBox>
      ) : null}
    </div>
  );
}
