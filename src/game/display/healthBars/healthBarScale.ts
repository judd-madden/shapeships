import type {
  ResolvedHealthIdentity,
  ResolvedHealthPresentation,
} from '../../client/gameSession/types';

export type HealthBarOrientation = 'desktop' | 'mobile';

export const HEALTH_BAR_LEGEND_LABEL_LIMITS = Object.freeze({ mobile: 9, desktop: 10 });

/** Presentation settings only; these never establish an authoritative player cap. */
export const HEALTH_BAR_SCALE_CONFIG = Object.freeze({
  desktop: Object.freeze({ minimumPositiveFraction: 0.35, minimumLabelSpacing: 24 }),
  mobile: Object.freeze({ minimumPositiveFraction: 0.35, minimumLabelSpacing: 24 }),
});

export interface HealthBarScaleContext {
  readonly identity: Readonly<ResolvedHealthIdentity>;
  /** Caller-owned session/recovery identity; change on reset, gaps or recovery. */
  readonly continuityKey: string;
}

export interface HealthBarScaleGeometry {
  /** Optional coordinated transition mapping; ordinary prepared geometry stays numeric. */
  readonly mapValue?: (value: number) => number | null;
  readonly domainMin: number;
  readonly domainMax: number;
  readonly zeroPosition: number;
  readonly positiveFraction: number;
  readonly minimumPositiveFraction: number;
  readonly negativeCompression: boolean;
}

export interface HealthBarCapPosition {
  readonly playerId: string;
  readonly value: number | null;
  readonly position: number | null;
}

export interface PreparedHealthBarScale extends HealthBarScaleGeometry, HealthBarScaleContext {
  readonly orientation: HealthBarOrientation;
  readonly sourceMode: ResolvedHealthPresentation['mode'];
  readonly presentationKey: string | null;
  readonly resolvedTurnNumber: number | null;
  readonly isTerminal: boolean;
  readonly leftCap: Readonly<HealthBarCapPosition>;
  readonly rightCap: Readonly<HealthBarCapPosition>;
}

function sameIdentity(a: Readonly<ResolvedHealthIdentity>, b: Readonly<ResolvedHealthIdentity>): boolean {
  return a.gameId === b.gameId && a.viewerId === b.viewerId && a.viewerRole === b.viewerRole &&
    a.leftPlayerId === b.leftPlayerId && a.rightPlayerId === b.rightPlayerId;
}

/**
 * The single mapping for bars, contribution geometry, caps and legend.
 * 0 = domain minimum; 1 = domain maximum. Mobile increases left-to-right;
 * desktop increases bottom-to-top. No clipping or orientation-specific mathematics.
 */
export function mapHealthBarValue(scale: HealthBarScaleGeometry, value: number): number | null {
  if (!Number.isFinite(value) || value < scale.domainMin || value > scale.domainMax) return null;
  if (scale.mapValue) return scale.mapValue(value);
  if (value === scale.domainMin) return 0;
  if (value === scale.domainMax) return 1;
  if (value === 0) return scale.zeroPosition;
  return value < 0
    ? scale.zeroPosition * (1 - value / scale.domainMin)
    : scale.zeroPosition + scale.positiveFraction * (value / scale.domainMax);
}

/** Inverse of a frozen prepared scale, used for screen-space endpoint movement. */
export function unmapHealthBarValue(scale: HealthBarScaleGeometry, position: number): number {
  if (position <= 0) return scale.domainMin;
  if (position >= 1) return scale.domainMax;
  if (position === scale.zeroPosition) return 0;
  return position < scale.zeroPosition
    ? scale.domainMin * (1 - position / scale.zeroPosition)
    : scale.domainMax * ((position - scale.zeroPosition) / scale.positiveFraction);
}

/**
 * Prepare once from BOTH players' complete incoming authoritative presentation.
 * Adopt together before motion; freeze through damage/clearance/healing/surplus/
 * settling and retain through build/selection. Explicitly prepare again at the
 * next resolution with the caller's per-game negative floor. Positive bounds may
 * contract; never derive either bound from animated intermediate values.
 */
export function prepareHealthBarScale(
  presentation: ResolvedHealthPresentation,
  context: HealthBarScaleContext,
  options: {
    readonly orientation: HealthBarOrientation;
    readonly minimumPositiveFraction?: number;
    readonly retainedNegativeFloor?: number;
  },
): Readonly<PreparedHealthBarScale> | null {
  const config = HEALTH_BAR_SCALE_CONFIG[options.orientation];
  if (!config) return null;
  const minimumPositiveFraction = options.minimumPositiveFraction ?? config.minimumPositiveFraction;
  const retainedNegativeFloor = options.retainedNegativeFloor ?? 0;
  if (!Number.isFinite(minimumPositiveFraction) || minimumPositiveFraction <= 0 || minimumPositiveFraction >= 1 ||
      !Number.isFinite(retainedNegativeFloor) || retainedNegativeFloor > 0 ||
      !context.continuityKey) return null;
  const source = presentation.mode === 'live' ? presentation.snapshot : presentation;
  if (!sameIdentity(source.identity, context.identity) ||
      (presentation.mode === 'live' && presentation.snapshot.continuityKey !== context.continuityKey) ||
      source.left.playerId !== context.identity.leftPlayerId ||
      source.right.playerId !== context.identity.rightPlayerId) return null;

  const represented = presentation.mode === 'live'
    ? [presentation.snapshot.left, presentation.snapshot.right].flatMap((side) =>
        [side.startHealth, side.damageStageHealth, side.finalHealth])
    : [presentation.left.health, presentation.right.health];
  const caps = [source.left.maxHealth, source.right.maxHealth];
  const liveNumbers = presentation.mode === 'live'
    ? [presentation.snapshot.left, presentation.snapshot.right].flatMap((side) =>
        [side.damageTaken, side.grossHealingReceived, side.actualNetDelta]) : [];
  if (![...represented, ...liveNumbers].every(Number.isFinite) ||
      caps.some((cap) => cap !== null && (!Number.isFinite(cap) || cap <= 0))) return null;

  const requiredMin = Math.min(0, retainedNegativeFloor, ...represented);
  const requiredMax = Math.max(35, ...represented, ...caps.filter((cap): cap is number => cap !== null));
  const roundExtentOutward = (extent: number): number => {
    // Keep subnormal negatives represented, and never shrink/overflow finite extreme bounds.
    const rounded = Math.ceil(Math.max(5, extent) / 5) * 5;
    return Number.isFinite(rounded) ? Math.max(extent, rounded) : extent;
  };
  const domainMin = requiredMin < 0 ? -roundExtentOutward(-requiredMin) : 0;
  const domainMax = roundExtentOutward(requiredMax);
  // Normalize BEFORE summing: domainMax + abs(domainMin) can overflow for finite endpoints.
  const magnitude = Math.max(domainMax, -domainMin);
  const positiveUnits = domainMax / magnitude;
  const negativeUnits = Math.abs(domainMin) / magnitude;
  const totalUnits = positiveUnits + negativeUnits;
  const naturalPositiveFraction = positiveUnits / totalUnits;
  const negativeCompression = domainMin < 0 && naturalPositiveFraction < minimumPositiveFraction;
  const zeroPosition = negativeCompression ? 1 - minimumPositiveFraction : negativeUnits / totalUnits;
  const positiveFraction = negativeCompression ? minimumPositiveFraction : naturalPositiveFraction;
  const geometry: HealthBarScaleGeometry = {
    domainMin, domainMax, zeroPosition, positiveFraction, minimumPositiveFraction, negativeCompression,
  };
  const capPosition = (side: typeof source.left): Readonly<HealthBarCapPosition> => Object.freeze({
    playerId: side.playerId, value: side.maxHealth,
    position: side.maxHealth === null ? null : mapHealthBarValue(geometry, side.maxHealth),
  });
  return Object.freeze({
    ...geometry, identity: Object.freeze({ ...source.identity }), continuityKey: context.continuityKey,
    orientation: options.orientation, sourceMode: presentation.mode,
    presentationKey: presentation.mode === 'live' ? presentation.snapshot.presentationKey : null,
    resolvedTurnNumber: presentation.mode === 'live' ? presentation.snapshot.resolvedTurnNumber : null,
    isTerminal: source.outcome.isTerminal,
    leftCap: capPosition(source.left), rightCap: capPosition(source.right),
  });
}

/**
 * Identity guard only, not another resolution lifecycle. The caller uses existing
 * lifecycle seams to prepare the next resolution or fresh settled recovery data.
 * Ordinary DTO updates, release and resize do not themselves replace this object.
 */
export function retainPreparedHealthBarScale(
  prepared: Readonly<PreparedHealthBarScale> | null,
  context: HealthBarScaleContext | null,
): Readonly<PreparedHealthBarScale> | null {
  return prepared && context && prepared.continuityKey === context.continuityKey &&
    sameIdentity(prepared.identity, context.identity) ? prepared : null;
}

export interface HealthBarLegendLabel {
  readonly value: number;
  readonly position: number;
  readonly label: string;
}

/** Smallest readable step >= requested; null when the next sensible step overflows. */
function readableStep(requested: number): number | null {
  if (requested <= 5) return 5;
  const decade = 10 ** Math.floor(Math.log10(requested));
  for (const multiple of [1, 2, 5, 10]) {
    const step = decade * multiple;
    if (Number.isFinite(step) && step >= requested) return step;
  }
  return null;
}

/**
 * Labels only: resize/spacing never changes prepared geometry or replays contributions.
 * Zero and exact positive top are mandatory even when they overlap on tiny axes.
 * Both orientations keep readable regional increments and negative context within
 * their shared label limits.
 * Spacing is a configurable center-to-center estimate; real text measurement is deferred.
 */
export function calculateHealthBarLegend(
  scale: Readonly<PreparedHealthBarScale>,
  options: {
    readonly axisLength: number;
    readonly orientation?: HealthBarOrientation;
    readonly minimumLabelSpacing?: number;
  },
): readonly Readonly<HealthBarLegendLabel>[] {
  const orientation = options.orientation ?? scale.orientation;
  const labelLimit = HEALTH_BAR_LEGEND_LABEL_LIMITS[orientation];
  const config = HEALTH_BAR_SCALE_CONFIG[orientation];
  const axisLength = Number.isFinite(options.axisLength) ? Math.max(0, options.axisLength) : 0;
  const requestedSpacing = options.minimumLabelSpacing ?? config.minimumLabelSpacing;
  const spacing = Number.isFinite(requestedSpacing) && requestedSpacing > 0
    ? requestedSpacing : config.minimumLabelSpacing;
  const labels: Readonly<HealthBarLegendLabel>[] = [];
  const add = (candidate: number, mandatory = false) => {
    const value = candidate === 0 ? 0 : candidate;
    const position = mapHealthBarValue(scale, value);
    if (position === null || labels.some((label) => label.value === value)) return;
    if (!mandatory && labels.some((label) => Math.abs(label.position - position) * axisLength < spacing)) return;
    labels.push(Object.freeze({ value, position, label: String(value) }));
  };
  const stepFor = (extent: number, fraction: number) => {
    const slots = Math.min(labelLimit - 1, Math.floor(axisLength * fraction / spacing));
    return slots > 0 && extent > 0 ? readableStep(extent / slots) : null;
  };
  const ticksFor = (extent: number, sign: 1 | -1, step: number | null): number[] => {
    const ticks: number[] = [];
    if (step !== null) {
      for (let index = 1; index <= labelLimit - 1; index += 1) {
        const value = index * step;
        if (!Number.isFinite(value) || value > extent || (sign === 1 && value === extent)) break;
        ticks.push(sign * value);
      }
    }
    // Even tiny axes retain negative context; a -5 domain therefore always labels -5.
    return sign === -1 && extent > 0 && ticks.length === 0 ? [-extent] : ticks;
  };
  let positiveStep = stepFor(scale.domainMax, scale.positiveFraction);
  let negativeStep = stepFor(-scale.domainMin, scale.zeroPosition);
  let positiveTicks = ticksFor(scale.domainMax, 1, positiveStep);
  let negativeTicks = ticksFor(-scale.domainMin, -1, negativeStep);
  // Coarsen complete regions rather than letting insertion order consume the budget.
  while (positiveTicks.length + negativeTicks.length + 2 > labelLimit) {
    if (negativeTicks.length > positiveTicks.length) {
      negativeStep = negativeStep === null ? null : readableStep(negativeStep * 2);
      negativeTicks = ticksFor(-scale.domainMin, -1, negativeStep);
    } else {
      positiveStep = positiveStep === null ? null : readableStep(positiveStep * 2);
      positiveTicks = ticksFor(scale.domainMax, 1, positiveStep);
    }
  }
  add(0, true);
  add(scale.domainMax, true);
  // Preserve negative context even on tiny axes. Desktop optional ticks retain
  // mapped spacing; mobile permits the exact top beside its final regional tick.
  if (negativeTicks.length) add(negativeTicks[negativeTicks.length - 1], true);
  for (const value of [...negativeTicks, ...positiveTicks]) add(value, orientation === 'mobile');
  return Object.freeze(labels.sort((a, b) => a.position - b.position));
}
