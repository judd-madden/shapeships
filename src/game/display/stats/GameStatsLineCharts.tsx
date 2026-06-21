import type { GameStatsTurnViewModel } from '../../client/gameSession/types';
import type { GameStatsScale } from './gameStatsScales';

interface GameStatsHealthLineChartProps {
  turns: GameStatsTurnViewModel[];
  scale: GameStatsScale;
  healthFloor: number;
}

interface GameStatsFleetValueStepChartProps {
  turns: GameStatsTurnViewModel[];
  scale: GameStatsScale;
}

interface ChartPoint {
  x: number;
  y: number;
}

const HEALTH_TOP_VALUE = 35;
const DEFAULT_HEALTH_FLOOR = -10;
const LINE_STROKE_WIDTH_PX = 3;
const HEALTH_NODE_RADIUS_PX = 4;
const SINGLE_TURN_STEP_HALF_WIDTH_PERCENT = 2;

export function GameStatsHealthLineChart({
  turns,
  scale,
  healthFloor,
}: GameStatsHealthLineChartProps) {
  if (turns.length === 0) {
    return null;
  }

  const viewerPoints = turns.map((turn, index) => ({
    x: getTurnXPercent(index, turns.length),
    y: getHealthYPercent(turn.viewer.healthEnd, scale, healthFloor),
  }));
  const opponentPoints = turns.map((turn, index) => ({
    x: getTurnXPercent(index, turns.length),
    y: getHealthYPercent(turn.opponent.healthEnd, scale, healthFloor),
  }));

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
      focusable="false"
    >
      <HealthLineSegments points={viewerPoints} color="var(--shapeships-white)" />
      <HealthLineSegments points={opponentPoints} color="var(--shapeships-grey-50)" />
      <HealthNodes points={viewerPoints} color="var(--shapeships-white)" />
      <HealthNodes points={opponentPoints} color="var(--shapeships-grey-50)" />
    </svg>
  );
}

export function GameStatsFleetValueStepChart({
  turns,
  scale,
}: GameStatsFleetValueStepChartProps) {
  if (turns.length === 0) {
    return null;
  }

  const viewerPath = buildFleetStepPath(
    turns.map((turn, index) => ({
      x: getTurnXPercent(index, turns.length),
      y: getFleetValueYPercent(turn.viewer.fleetValueEnd, scale),
    })),
  );
  const opponentPath = buildFleetStepPath(
    turns.map((turn, index) => ({
      x: getTurnXPercent(index, turns.length),
      y: getFleetValueYPercent(turn.opponent.fleetValueEnd, scale),
    })),
  );

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {viewerPath ? (
        <path
          d={viewerPath}
          fill="none"
          stroke="var(--shapeships-pastel-blue)"
          strokeWidth={LINE_STROKE_WIDTH_PX}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {opponentPath ? (
        <path
          d={opponentPath}
          fill="none"
          stroke="var(--shapeships-pastel-purple)"
          strokeWidth={LINE_STROKE_WIDTH_PX}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

function HealthLineSegments({
  points,
  color,
}: {
  points: ChartPoint[];
  color: string;
}) {
  return (
    <>
      {points.slice(1).map((point, index) => {
        const previousPoint = points[index];
        if (!previousPoint) {
          return null;
        }

        return (
          <line
            key={`${previousPoint.x}:${previousPoint.y}:${point.x}:${point.y}`}
            x1={`${previousPoint.x}%`}
            y1={`${previousPoint.y}%`}
            x2={`${point.x}%`}
            y2={`${point.y}%`}
            fill="none"
            stroke={color}
            strokeWidth={LINE_STROKE_WIDTH_PX}
          />
        );
      })}
    </>
  );
}

function HealthNodes({
  points,
  color,
}: {
  points: ChartPoint[];
  color: string;
}) {
  return (
    <>
      {points.map((point, index) => (
        <circle
          key={`${point.x}:${point.y}:${index}`}
          cx={`${point.x}%`}
          cy={`${point.y}%`}
          r={HEALTH_NODE_RADIUS_PX}
          fill={color}
          stroke={color}
        />
      ))}
    </>
  );
}

function buildFleetStepPath(points: ChartPoint[]): string | null {
  if (points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    const point = points[0];
    if (!point) {
      return null;
    }

    const startX = clamp(point.x - SINGLE_TURN_STEP_HALF_WIDTH_PERCENT, 0, 100);
    const endX = clamp(point.x + SINGLE_TURN_STEP_HALF_WIDTH_PERCENT, 0, 100);

    return `M ${formatChartNumber(startX)} ${formatChartNumber(point.y)} H ${formatChartNumber(endX)}`;
  }

  const firstPoint = points[0];
  if (!firstPoint) {
    return null;
  }

  const commands = [
    `M ${formatChartNumber(firstPoint.x)} ${formatChartNumber(firstPoint.y)}`,
  ];

  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex];
    if (!point) {
      continue;
    }

    commands.push(
      `H ${formatChartNumber(point.x)}`,
      `V ${formatChartNumber(point.y)}`,
    );
  }

  return commands.join(' ');
}

function getHealthYPercent(
  value: number,
  scale: GameStatsScale,
  healthFloor: number,
): number {
  const healthValue = finiteNumber(value);
  const topPosition = getScaleLabelPosition(scale, String(HEALTH_TOP_VALUE), 0);
  const zeroPosition = getScaleLabelPosition(scale, '0', 87.5);
  const floorPosition = getScaleLabelPosition(
    scale,
    '-INF',
    scale.positions[scale.positions.length - 1] ?? 100,
  );
  const visualFloor = Number.isFinite(healthFloor) && healthFloor < 0
    ? healthFloor
    : DEFAULT_HEALTH_FLOOR;

  if (healthValue >= HEALTH_TOP_VALUE) {
    return clamp(topPosition, 0, 100);
  }

  if (healthValue >= 0) {
    const healthProgress = (HEALTH_TOP_VALUE - healthValue) / HEALTH_TOP_VALUE;

    return clamp(
      topPosition + healthProgress * (zeroPosition - topPosition),
      0,
      100,
    );
  }

  const clampedHealth = clamp(healthValue, visualFloor, 0);
  const floorProgress = (0 - clampedHealth) / (0 - visualFloor);

  return clamp(
    zeroPosition + floorProgress * (floorPosition - zeroPosition),
    0,
    100,
  );
}

function getFleetValueYPercent(value: number, scale: GameStatsScale): number {
  const minValue = Number.isFinite(scale.minValue) ? Number(scale.minValue) : 0;
  const maxValue =
    Number.isFinite(scale.maxValue) && Number(scale.maxValue) > minValue
      ? Number(scale.maxValue)
      : 10;
  const clampedValue = clamp(finiteNumber(value), minValue, maxValue);
  const progress = (clampedValue - minValue) / (maxValue - minValue);

  return clamp(100 - progress * 100, 0, 100);
}

function getTurnXPercent(index: number, turnCount: number): number {
  if (turnCount <= 0) {
    return 50;
  }

  return ((index + 0.5) / turnCount) * 100;
}

function getScaleLabelPosition(
  scale: GameStatsScale,
  label: string,
  fallback: number,
): number {
  const labelIndex = scale.labels.findIndex((scaleLabel) => scaleLabel === label);
  const position = labelIndex >= 0 ? scale.positions[labelIndex] : fallback;

  return Number.isFinite(position) ? position : fallback;
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatChartNumber(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '');
}
