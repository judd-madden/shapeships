/** All editable health-bar animation timings live here. Values are presentation-only. */
export const HEALTH_BAR_ANIMATION_CONFIG = Object.freeze({
  minimumMovementMs: 700,
  maximumMovementMs: 1400,
  handoverMs: 200,
  scaleTransitionMs: 350,
  finalSettleMs: 0,
  settledNumberTweenMs: 300,
  outcomeLetterFadeMs: 400,
  easing: Object.freeze([0.7, 0, 0.3, 1] as const),
});

/** Development replay only; production resolution playback never loops. */
export const HEALTH_BAR_ANIMATION_DEV_CONFIG = Object.freeze({ completedHoldMs: 1200 });

export function healthBarMovementDuration(travelFraction: number): number {
  const { minimumMovementMs, maximumMovementMs } = HEALTH_BAR_ANIMATION_CONFIG;
  return Math.max(minimumMovementMs, Math.min(maximumMovementMs, Math.abs(travelFraction) * maximumMovementMs));
}

/** Solve x(t) for the supplied elapsed-time fraction, then evaluate y(t). */
export function healthBarEasing(fraction: number): number {
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  const [x1, y1, x2, y2] = HEALTH_BAR_ANIMATION_CONFIG.easing;
  const coordinate = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i += 1) {
    const t = (low + high) / 2;
    if (coordinate(t, x1, x2) < fraction) low = t;
    else high = t;
  }
  return coordinate((low + high) / 2, y1, y2);
}
