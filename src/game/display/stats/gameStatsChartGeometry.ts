import type { GameStatsScale } from './gameStatsScales';

const DEFAULT_HEALTH_TOP_VALUE = 35;
const DEFAULT_HEALTH_FLOOR = -10;

export function getGameStatsTurnXPercent(
  index: number,
  turnCount: number,
): number {
  if (turnCount <= 0) {
    return 50;
  }

  return ((index + 0.5) / turnCount) * 100;
}

export function getGameStatsHealthYPercent(
  value: number,
  scale: GameStatsScale,
  healthFloor: number,
): number {
  const healthValue = finiteNumber(value);
  const topPosition = Number.isFinite(scale.positions[0])
    ? Number(scale.positions[0])
    : 0;
  const topValue = Number.isFinite(scale.maxValue) && Number(scale.maxValue) > 0
    ? Number(scale.maxValue)
    : DEFAULT_HEALTH_TOP_VALUE;
  const zeroPosition = getGameStatsScaleLabelPosition(scale, '0', 87.5);
  const floorPosition = getGameStatsScaleLabelPosition(
    scale,
    '-INF',
    scale.positions[scale.positions.length - 1] ?? 100,
  );
  const visualFloor = Number.isFinite(healthFloor) && healthFloor < 0
    ? healthFloor
    : DEFAULT_HEALTH_FLOOR;

  if (healthValue >= topValue) {
    return clampGameStatsPercent(topPosition);
  }

  if (healthValue >= 0) {
    const healthProgress = (topValue - healthValue) / topValue;

    return clampGameStatsPercent(
      topPosition + healthProgress * (zeroPosition - topPosition),
    );
  }

  const clampedHealth = clampGameStatsNumber(healthValue, visualFloor, 0);
  const floorProgress = (0 - clampedHealth) / (0 - visualFloor);

  return clampGameStatsPercent(
    zeroPosition + floorProgress * (floorPosition - zeroPosition),
  );
}

export function getGameStatsFleetValueYPercent(
  value: number,
  scale: GameStatsScale,
): number {
  const minValue = Number.isFinite(scale.minValue) ? Number(scale.minValue) : 0;
  const maxValue =
    Number.isFinite(scale.maxValue) && Number(scale.maxValue) > minValue
      ? Number(scale.maxValue)
      : 10;
  const clampedValue = clampGameStatsNumber(finiteNumber(value), minValue, maxValue);
  const progress = (clampedValue - minValue) / (maxValue - minValue);

  return clampGameStatsPercent(100 - progress * 100);
}

export function getGameStatsScaleLabelPosition(
  scale: GameStatsScale,
  label: string,
  fallback: number,
): number {
  const labelIndex = scale.labels.findIndex((scaleLabel) => scaleLabel === label);
  const position = labelIndex >= 0 ? scale.positions[labelIndex] : fallback;

  return Number.isFinite(position) ? Number(position) : fallback;
}

export function clampGameStatsPercent(value: number): number {
  return clampGameStatsNumber(value, 0, 100);
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clampGameStatsNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
