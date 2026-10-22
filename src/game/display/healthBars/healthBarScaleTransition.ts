import {
  calculateHealthBarLegend, mapHealthBarValue,
  type HealthBarLegendLabel, type HealthBarOrientation, type PreparedHealthBarScale,
} from './healthBarScale';

export type HealthBarScales = Readonly<Record<HealthBarOrientation, Readonly<PreparedHealthBarScale>>>;
export interface HealthBarTransitionLabel extends HealthBarLegendLabel { readonly opacity: number }
export interface HealthBarLegendTransition {
  readonly from: readonly Readonly<HealthBarLegendLabel>[];
  readonly to: readonly Readonly<HealthBarLegendLabel>[];
}

export function sameHealthBarMapping(a: PreparedHealthBarScale, b: PreparedHealthBarScale): boolean {
  return a.domainMin === b.domainMin && a.domainMax === b.domainMax && a.zeroPosition === b.zeroPosition &&
    a.leftCap.value === b.leftCap.value && a.rightCap.value === b.rightCap.value;
}

/** Shared by rectangles, zero/cap markers and legend. No independent CSS transitions. */
export function interpolateHealthBarScale(
  from: Readonly<PreparedHealthBarScale>, to: Readonly<PreparedHealthBarScale>, progress: number,
): Readonly<PreparedHealthBarScale> {
  if (progress >= 1) return to;
  const p = Math.max(0, progress);
  const endpoint = (scale: PreparedHealthBarScale, value: number) =>
    mapHealthBarValue(scale, Math.max(scale.domainMin, Math.min(scale.domainMax, value)))!;
  const mapValue = (value: number) => (1 - p) * endpoint(from, value) + p * endpoint(to, value);
  const zeroPosition = mapValue(0);
  const cap = (item: PreparedHealthBarScale['leftCap']) => Object.freeze({
    ...item, position: item.value === null ? null : mapValue(item.value),
  });
  return Object.freeze({
    ...to, domainMin: Math.min(from.domainMin, to.domainMin), domainMax: Math.max(from.domainMax, to.domainMax),
    zeroPosition, positiveFraction: 1 - zeroPosition, mapValue,
    negativeCompression: p === 0 ? from.negativeCompression : from.negativeCompression || to.negativeCompression,
    leftCap: cap(to.leftCap), rightCap: cap(to.rightCap),
  });
}

/** Tick selection is cached by the caller for the transition and physical dimensions. */
export function prepareHealthBarLegendTransition(
  from: PreparedHealthBarScale, to: PreparedHealthBarScale, orientation: HealthBarOrientation, axisLength: number,
): HealthBarLegendTransition {
  return Object.freeze({
    from: calculateHealthBarLegend(from, { orientation, axisLength }),
    to: calculateHealthBarLegend(to, { orientation, axisLength }),
  });
}

export function sampleHealthBarLegendTransition(
  transition: HealthBarLegendTransition, scale: PreparedHealthBarScale, progress: number,
): readonly HealthBarTransitionLabel[] {
  const p = Math.max(0, Math.min(1, progress));
  const oldValues = new Set(transition.from.map((label) => label.value));
  const newValues = new Set(transition.to.map((label) => label.value));
  const labels = new Map([...transition.from, ...transition.to].map((label) => [label.value, label]));
  return [...labels.values()].map((label) => ({
    ...label, position: mapHealthBarValue(scale, label.value) ?? label.position,
    opacity: oldValues.has(label.value) ? (newValues.has(label.value) ? 1 : 1 - p) : p,
  }));
}
