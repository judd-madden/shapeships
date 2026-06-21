import type { GameStatsTurnViewModel } from '../../client/gameSession/types';
import type { GameStatsScale } from './gameStatsScales';

interface GameStatsPressureBarChartProps {
  turns: GameStatsTurnViewModel[];
  scale: GameStatsScale;
  getUpwardValue: (turn: GameStatsTurnViewModel) => number;
  getDownwardValue: (turn: GameStatsTurnViewModel) => number;
  upwardColor: string;
  downwardColor: string;
}

interface PressureGeometry {
  topPosition: number;
  zeroPosition: number;
  bottomPosition: number;
  maxValue: number;
}

interface PressureBarLayout {
  barStart: number;
  barHeight: number;
  labelPosition: string;
  labelInset: boolean;
}

const PRESSURE_BAR_WIDTH_CSS = 'clamp(20px, 70%, 35px)';
const VALUE_LABEL_FONT_SIZE_PX = 15;
const VALUE_LABEL_LINE_HEIGHT_PX = 15;
const VALUE_LABEL_GAP_PX = 4;
const VALUE_LABEL_INSET_EDGE_THRESHOLD_PERCENT = 14;
const DEFAULT_PRESSURE_MAX_VALUE = 10;

export function GameStatsPressureBarChart({
  turns,
  scale,
  getUpwardValue,
  getDownwardValue,
  upwardColor,
  downwardColor,
}: GameStatsPressureBarChartProps) {
  if (turns.length === 0) {
    return null;
  }

  const geometry = getPressureGeometry(scale);

  return (
    <div
      className="pointer-events-none grid h-full min-h-0"
      style={{
        gridTemplateColumns: `repeat(${turns.length}, minmax(0, 1fr))`,
      }}
      aria-hidden="true"
    >
      {turns.map((turn) => {
        const upwardValue = finiteNumber(getUpwardValue(turn));
        const downwardValue = finiteNumber(getDownwardValue(turn));
        const upwardBar = getPressureBarLayout(upwardValue, 'up', geometry);
        const downwardBar = getPressureBarLayout(downwardValue, 'down', geometry);

        return (
          <div
            key={turn.turnNumber}
            className="relative min-h-0 min-w-0"
          >
            <PressureBar
              color={upwardColor}
              layout={upwardBar}
              direction="up"
            />
            <PressureBar
              color={downwardColor}
              layout={downwardBar}
              direction="down"
            />
            <PressureValueLabel
              value={upwardValue}
              color={upwardColor}
              layout={upwardBar}
            />
            <PressureValueLabel
              value={downwardValue}
              color={downwardColor}
              layout={downwardBar}
            />
          </div>
        );
      })}
    </div>
  );
}

function PressureBar({
  color,
  layout,
  direction,
}: {
  color: string;
  layout: PressureBarLayout;
  direction: 'up' | 'down';
}) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        width: PRESSURE_BAR_WIDTH_CSS,
        height: `${layout.barHeight}%`,
        backgroundColor: color,
        top: direction === 'down' ? `${layout.barStart}%` : undefined,
        bottom: direction === 'up' ? `${100 - layout.barStart}%` : undefined,
      }}
    />
  );
}

function PressureValueLabel({
  value,
  color,
  layout,
}: {
  value: number;
  color: string;
  layout: PressureBarLayout;
}) {
  return (
    <span
      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center font-medium"
      style={{
        top: layout.labelPosition,
        color: layout.labelInset ? 'var(--shapeships-black)' : color,
        fontSize: VALUE_LABEL_FONT_SIZE_PX,
        lineHeight: `${VALUE_LABEL_LINE_HEIGHT_PX}px`,
        fontVariationSettings: "'wdth' 100",
        zIndex: 1,
      }}
    >
      {formatWholeNumber(value)}
    </span>
  );
}

function getPressureBarLayout(
  value: number,
  direction: 'up' | 'down',
  geometry: PressureGeometry,
): PressureBarLayout {
  const visualValue = clamp(finiteNumber(value), 0, geometry.maxValue);
  const progress = geometry.maxValue > 0 ? visualValue / geometry.maxValue : 0;

  if (direction === 'up') {
    const availableHeight = Math.max(0, geometry.zeroPosition - geometry.topPosition);
    const barHeight = availableHeight * progress;
    const barTop = geometry.zeroPosition - barHeight;
    const labelInset = shouldInsetPressureLabel(value, barTop, geometry, 'up');
    const labelPosition = labelInset
      ? `calc(${formatPercent(barTop)} + ${VALUE_LABEL_GAP_PX}px)`
      : `calc(${formatPercent(barTop)} - ${VALUE_LABEL_LINE_HEIGHT_PX + VALUE_LABEL_GAP_PX}px)`;

    return {
      barStart: geometry.zeroPosition,
      barHeight,
      labelPosition,
      labelInset,
    };
  }

  const availableHeight = Math.max(0, geometry.bottomPosition - geometry.zeroPosition);
  const barHeight = availableHeight * progress;
  const barBottom = geometry.zeroPosition + barHeight;
  const labelInset = shouldInsetPressureLabel(value, barBottom, geometry, 'down');
  const labelPosition = labelInset
    ? `calc(${formatPercent(barBottom)} - ${VALUE_LABEL_LINE_HEIGHT_PX + VALUE_LABEL_GAP_PX}px)`
    : `calc(${formatPercent(barBottom)} + ${VALUE_LABEL_GAP_PX}px)`;

  return {
    barStart: geometry.zeroPosition,
    barHeight,
    labelPosition,
    labelInset,
  };
}

function getPressureGeometry(scale: GameStatsScale): PressureGeometry {
  const fallbackTop = 0;
  const fallbackZero = 50;
  const fallbackBottom = 100;
  const topPosition = sanitizePosition(scale.positions[0], fallbackTop);
  const zeroPosition = sanitizePosition(
    getScaleLabelPosition(scale, '0', scale.positions[2] ?? fallbackZero),
    fallbackZero,
  );
  const bottomPosition = sanitizePosition(
    scale.positions[scale.positions.length - 1],
    fallbackBottom,
  );
  const hasValidOrder = topPosition < zeroPosition && zeroPosition < bottomPosition;
  const maxValue =
    Number.isFinite(scale.maxValue) && Number(scale.maxValue) > 0
      ? Number(scale.maxValue)
      : parsePositiveScaleLabel(scale.labels[0]) ?? DEFAULT_PRESSURE_MAX_VALUE;

  return {
    topPosition: hasValidOrder ? topPosition : fallbackTop,
    zeroPosition: hasValidOrder ? zeroPosition : fallbackZero,
    bottomPosition: hasValidOrder ? bottomPosition : fallbackBottom,
    maxValue,
  };
}

function getScaleLabelPosition(
  scale: GameStatsScale,
  label: string,
  fallback: number,
): number {
  const labelIndex = scale.labels.findIndex((scaleLabel) => scaleLabel === label);
  const position = labelIndex >= 0 ? scale.positions[labelIndex] : fallback;

  return Number.isFinite(position) ? Number(position) : fallback;
}

function shouldInsetPressureLabel(
  value: number,
  barEndPosition: number,
  geometry: PressureGeometry,
  direction: 'up' | 'down',
): boolean {
  if (finiteNumber(value) <= 0) {
    return false;
  }

  if (direction === 'up') {
    return barEndPosition <= geometry.topPosition + VALUE_LABEL_INSET_EDGE_THRESHOLD_PERCENT;
  }

  return barEndPosition >= geometry.bottomPosition - VALUE_LABEL_INSET_EDGE_THRESHOLD_PERCENT;
}

function parsePositiveScaleLabel(label: string | undefined): number | null {
  const parsedValue = Number(label);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function sanitizePosition(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? clamp(Number(value), 0, 100) : fallback;
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, '')}%`;
}

function formatWholeNumber(value: number): string {
  return String(Math.round(finiteNumber(value)));
}
