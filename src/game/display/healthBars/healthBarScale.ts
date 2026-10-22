import type {
  ResolvedHealthIdentity,
  ResolvedHealthPresentation,
} from '../../client/gameSession/types';

export type HealthBarOrientation = 'desktop' | 'mobile';

/** Presentation settings only; these never establish an authoritative player cap. */
export const HEALTH_BAR_SCALE_CONFIG = Object.freeze({
  desktop: Object.freeze({ minimumPositiveFraction: 0.35, minimumLabelSpacing: 24 }),
  mobile: Object.freeze({ minimumPositiveFraction: 0.35, minimumLabelSpacing: 48 }),
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
 * next resolution (contraction is allowed), never from animated intermediate values.
 * Numeric parameters are retained for a later coordinated scale-transition controller.
 */
export function prepareHealthBarScale(
  presentation: ResolvedHealthPresentation,
  context: HealthBarScaleContext,
  options: { readonly orientation: HealthBarOrientation; readonly minimumPositiveFraction?: number },
): Readonly<PreparedHealthBarScale> | null {
  const config = HEALTH_BAR_SCALE_CONFIG[options.orientation];
  if (!config) return null;
  const minimumPositiveFraction = options.minimumPositiveFraction ?? config.minimumPositiveFraction;
  if (!Number.isFinite(minimumPositiveFraction) || minimumPositiveFraction <= 0 || minimumPositiveFraction >= 1 ||
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

  const domainMin = Math.min(0, ...represented) || 0;
  const domainMax = Math.max(35, ...represented, ...caps.filter((cap): cap is number => cap !== null));
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

const MAX_REGION_CANDIDATES = 128;

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
  const config = HEALTH_BAR_SCALE_CONFIG[options.orientation ?? scale.orientation];
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
  add(0, true);
  add(scale.domainMax, true);
  if (scale.domainMin < 0) add(scale.domainMin);
  const region = (extent: number, fraction: number, sign: 1 | -1) => {
    const slots = Math.min(MAX_REGION_CANDIDATES, Math.floor(axisLength * fraction / spacing));
    if (slots < 1 || extent <= 0) return;
    const step = readableStep(extent / slots);
    if (step === null) return;
    for (let index = 1; index <= MAX_REGION_CANDIDATES; index += 1) {
      const value = index * step;
      if (!Number.isFinite(value) || value >= extent) break;
      add(sign * value);
    }
  };
  region(scale.domainMax, scale.positiveFraction, 1);
  region(-scale.domainMin, scale.zeroPosition, -1);
  return Object.freeze(labels.sort((a, b) => a.position - b.position));
}
