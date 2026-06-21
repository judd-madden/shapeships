import type { GameStatsTurnViewModel } from '../../client/gameSession/types';
import {
  clampGameStatsPercent,
  getGameStatsFleetValueYPercent,
  getGameStatsHealthYPercent,
  getGameStatsTurnXPercent,
} from './gameStatsChartGeometry';
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
    x: getGameStatsTurnXPercent(index, turns.length),
    y: getGameStatsHealthYPercent(turn.viewer.healthEnd, scale, healthFloor),
  }));
  const opponentPoints = turns.map((turn, index) => ({
    x: getGameStatsTurnXPercent(index, turns.length),
    y: getGameStatsHealthYPercent(turn.opponent.healthEnd, scale, healthFloor),
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
      x: getGameStatsTurnXPercent(index, turns.length),
      y: getGameStatsFleetValueYPercent(turn.viewer.fleetValueEnd, scale),
    })),
  );
  const opponentPath = buildFleetStepPath(
    turns.map((turn, index) => ({
      x: getGameStatsTurnXPercent(index, turns.length),
      y: getGameStatsFleetValueYPercent(turn.opponent.fleetValueEnd, scale),
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

    const startX = clampGameStatsPercent(
      point.x - SINGLE_TURN_STEP_HALF_WIDTH_PERCENT,
    );
    const endX = clampGameStatsPercent(
      point.x + SINGLE_TURN_STEP_HALF_WIDTH_PERCENT,
    );

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

function formatChartNumber(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '');
}
