import {
  calculateHealthBarLegend, HEALTH_BAR_LEGEND_LABEL_LIMITS, mapHealthBarValue,
  type HealthBarLegendLabel, type HealthBarOrientation, type PreparedHealthBarScale,
} from './healthBarScale';

export type HealthBarScales = Readonly<Record<HealthBarOrientation, Readonly<PreparedHealthBarScale>>>;
export interface HealthBarTransitionLabel extends HealthBarLegendLabel { readonly opacity: number }
export interface HealthBarLegendTransition {
  readonly from: readonly Readonly<HealthBarLegendLabel>[];
  readonly to: readonly Readonly<HealthBarLegendLabel>[];
  readonly ticks: readonly Readonly<HealthBarLegendLabel & {
    readonly fade: 'constant' | 'outgoing' | 'incoming' | 'outgoing-optional' | 'incoming-optional';
  }>[];
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
  const oldLabels = calculateHealthBarLegend(from, { orientation, axisLength });
  const newLabels = calculateHealthBarLegend(to, { orientation, axisLength });
  const oldValues = new Set(oldLabels.map((label) => label.value));
  const newValues = new Set(newLabels.map((label) => label.value));
  const union = [...new Map([...oldLabels, ...newLabels].map((label) => [label.value, label])).values()]
    .sort((a, b) => a.value - b.value);
  const limit = HEALTH_BAR_LEGEND_LABEL_LIMITS[orientation];
  const staged = union.length > limit;
  // These anchors crossfade over the whole transition, including changing tops
  // and negative context. Only optional ticks share slots in separate halves.
  const anchors = new Set([0, from.domainMax, to.domainMax]);
  for (const labels of [oldLabels, newLabels]) {
    const negative = labels.find((label) => label.value < 0);
    if (negative) anchors.add(negative.value);
  }
  const selected = union.filter((label) => anchors.has(label.value));
  const position = (scale: PreparedHealthBarScale, value: number) =>
    mapHealthBarValue(scale, Math.max(scale.domainMin, Math.min(scale.domainMax, value)))!;
  // Farthest mapped coverage, with numeric ties, is independent of insertion order.
  const fill = (candidates: readonly Readonly<HealthBarLegendLabel>[], slots: number,
    scales: readonly PreparedHealthBarScale[], seed: readonly Readonly<HealthBarLegendLabel>[]) => {
    const picked = [...seed];
    const remaining = [...candidates].sort((a, b) => a.value - b.value);
    const result: Readonly<HealthBarLegendLabel>[] = [];
    while (result.length < slots && remaining.length) {
      let best = 0;
      let bestDistance = -1;
      for (let index = 0; index < remaining.length; index += 1) {
        const distance = Math.min(...scales.map((scale) => Math.min(...picked.map((label) =>
          Math.abs(position(scale, remaining[index].value) - position(scale, label.value))))));
        if (distance > bestDistance) { best = index; bestDistance = distance; }
      }
      const [label] = remaining.splice(best, 1);
      picked.push(label); result.push(label);
    }
    return result;
  };
  if (staged) {
    const common = fill(union.filter((label) => !anchors.has(label.value) &&
      oldValues.has(label.value) && newValues.has(label.value)), limit - selected.length, [from, to], selected);
    selected.push(...common);
    const slots = limit - selected.length;
    const outgoing = fill(oldLabels.filter((label) => !anchors.has(label.value) && !newValues.has(label.value)),
      slots, [from], selected);
    const incoming = fill(newLabels.filter((label) => !anchors.has(label.value) && !oldValues.has(label.value)),
      slots, [to], selected);
    selected.push(...outgoing, ...incoming);
  } else selected.splice(0, selected.length, ...union);
  const ticks = selected.sort((a, b) => a.value - b.value).map((label) => {
    const fade = oldValues.has(label.value) && newValues.has(label.value) ? 'constant' :
      oldValues.has(label.value) ? (staged && !anchors.has(label.value) ? 'outgoing-optional' : 'outgoing') :
        (staged && !anchors.has(label.value) ? 'incoming-optional' : 'incoming');
    return Object.freeze({ ...label, fade });
  });
  return Object.freeze({ from: oldLabels, to: newLabels, ticks: Object.freeze(ticks) });
}

export function sampleHealthBarLegendTransition(
  transition: HealthBarLegendTransition, scale: PreparedHealthBarScale, progress: number,
): readonly HealthBarTransitionLabel[] {
  const p = Math.max(0, Math.min(1, progress));
  const map = (label: HealthBarLegendLabel, opacity: number) => ({
    value: label.value, label: label.label,
    position: mapHealthBarValue(scale, label.value) ?? label.position, opacity,
  });
  if (p === 0 || p === 1) return (p === 0 ? transition.from : transition.to).map((label) => map(label, 1));
  return transition.ticks.map((tick) => map(tick, tick.fade === 'constant' ? 1 :
    tick.fade === 'outgoing' ? 1 - p : tick.fade === 'incoming' ? p :
      tick.fade === 'outgoing-optional' ? Math.max(0, 1 - 2 * p) : Math.max(0, 2 * p - 1)))
    .filter((tick) => tick.opacity > 0);
}
