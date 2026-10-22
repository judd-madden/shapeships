import {
  mapHealthBarValue,
  type HealthBarOrientation,
  type PreparedHealthBarScale,
} from './healthBarScale';

export interface HealthBarInterval {
  readonly from: number;
  readonly to: number;
}

/** Caller-owned visual state, independent of canonical health and scheduling. */
export interface HealthBarPresentationState {
  readonly health: number;
  readonly red?: HealthBarInterval;
  readonly green?: HealthBarInterval;
}

export type HealthBarSide = 'left' | 'right';

export interface HealthBarRectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export const HEALTH_BAR_PADDING = 2;
export const HEALTH_BAR_ZERO_THICKNESS = 3;

export function healthBarAxisLength(length: number): number {
  return Number.isFinite(length) ? Math.max(0, length) : 0;
}

/** Physical coordinate relative to the OUTER track, including its padding. */
export function healthBarValuePosition(
  scale: Readonly<PreparedHealthBarScale>, value: number,
  orientation: HealthBarOrientation, axisLength: number,
): number | null {
  const position = mapHealthBarValue(scale, value);
  return position === null ? null : HEALTH_BAR_PADDING +
    (orientation === 'desktop' ? 1 - position : position) * healthBarAxisLength(axisLength);
}

export function healthBarIntervalRectangle(
  scale: Readonly<PreparedHealthBarScale>, interval: HealthBarInterval,
  orientation: HealthBarOrientation, axisLength: number,
): HealthBarRectangle | null {
  const from = healthBarValuePosition(scale, interval.from, orientation, axisLength);
  const to = healthBarValuePosition(scale, interval.to, orientation, axisLength);
  if (from === null || to === null || from === to) return null;
  const start = Math.min(from, to);
  const length = Math.abs(to - from);
  return orientation === 'desktop'
    ? { left: 2, top: start, width: 24, height: length }
    : { left: start, top: 2, width: length, height: 10 };
}

export function calculateHealthBarGeometry(
  scale: Readonly<PreparedHealthBarScale>, side: HealthBarSide,
  state: HealthBarPresentationState, orientation: HealthBarOrientation, axisLength: number,
) {
  const length = healthBarAxisLength(axisLength);
  const desktop = orientation === 'desktop';
  const cap = side === 'left' ? scale.leftCap : scale.rightCap;
  const whiteHealth = Math.min(state.health, cap.value ?? Infinity);
  const rectangle = (interval: HealthBarInterval) =>
    healthBarIntervalRectangle(scale, interval, orientation, length);
  const zeroPosition = healthBarValuePosition(scale, 0, orientation, length)!;
  // Only the marker moves inward at an edge; the shared mapping stays exact.
  const zeroStart = HEALTH_BAR_PADDING + Math.max(0, Math.min(
    length - HEALTH_BAR_ZERO_THICKNESS,
    zeroPosition - HEALTH_BAR_PADDING - HEALTH_BAR_ZERO_THICKNESS / 2,
  ));
  const zero: HealthBarRectangle = desktop
    ? { left: HEALTH_BAR_PADDING, top: zeroStart, width: 24, height: HEALTH_BAR_ZERO_THICKNESS }
    : { left: zeroStart, top: HEALTH_BAR_PADDING, width: HEALTH_BAR_ZERO_THICKNESS, height: 10 };
  const capPosition = cap.value !== null && cap.value < scale.domainMax
    ? healthBarValuePosition(scale, cap.value, orientation, length) : null;
  const negativeEnd = healthBarValuePosition(scale, scale.domainMin, orientation, length)!;
  const compressionPosition = scale.negativeCompression
    ? zeroPosition + (desktop ? 1 : -1) * Math.min(8, Math.abs(negativeEnd - zeroPosition) / 2)
    : null;
  return {
    width: desktop ? 28 : length + 4,
    height: desktop ? length + 4 : 14,
    white: whiteHealth > 0 ? rectangle({ from: 0, to: whiteHealth }) : null,
    red: state.red ? rectangle(state.red) : null,
    green: state.green ? rectangle(state.green) : null,
    zero, zeroPosition, capPosition, compressionPosition,
  };
}
