import type { GameStatsTurnViewModel } from '../../client/gameSession/types';

export const HEALTH_AXIS_LABELS = ['35', '30', '25', '20', '15', '10', '5', '0', '-INF'];

export interface GameStatsScale {
  labels: string[];
  positions: number[];
  minValue?: number;
  maxValue?: number;
}

export function buildHealthScale(): GameStatsScale {
  return {
    labels: HEALTH_AXIS_LABELS,
    positions: getEvenPositions(HEALTH_AXIS_LABELS.length),
  };
}

export function buildPressureScale(turns: GameStatsTurnViewModel[]): GameStatsScale {
  const maxInput = turns.reduce((max, turn) => {
    return Math.max(
      max,
      finiteAbs(turn.viewer.healingReceived),
      finiteAbs(turn.opponent.damageDealt),
      finiteAbs(turn.viewer.damageDealt),
      finiteAbs(turn.opponent.healingReceived),
    );
  }, 0);
  const maxLabel = getPressureVisualMax(maxInput);
  const midpoint = maxLabel / 2;

  return {
    labels: [
      formatScaleLabel(maxLabel),
      formatScaleLabel(midpoint),
      '0',
      formatScaleLabel(midpoint),
      formatScaleLabel(maxLabel),
    ],
    positions: getEvenPositions(5),
    minValue: 0,
    maxValue: maxLabel,
  };
}

export function buildFleetValueScale(turns: GameStatsTurnViewModel[]): GameStatsScale {
  const maxInput = turns.reduce((max, turn) => {
    return Math.max(
      max,
      finiteNumber(turn.viewer.fleetValueEnd),
      finiteNumber(turn.opponent.fleetValueEnd),
    );
  }, 0);
  const maxLabel = getFleetVisualMax(maxInput);
  const labels = [
    maxLabel,
    maxLabel * 0.75,
    maxLabel * 0.5,
    maxLabel * 0.25,
    0,
  ].map(formatScaleLabel);

  return {
    labels,
    positions: getEvenPositions(labels.length),
    minValue: 0,
    maxValue: maxLabel,
  };
}

function getPressureVisualMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }

  const clamped = Math.min(value, 100);
  if (clamped <= 10) {
    return Math.max(2, Math.ceil(clamped / 2) * 2);
  }

  return Math.min(100, Math.ceil(clamped / 10) * 10);
}

function getFleetVisualMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }

  if (value <= 20) {
    return Math.ceil(value / 5) * 5;
  }

  if (value <= 100) {
    return Math.ceil(value / 10) * 10;
  }

  return Math.ceil(value / 25) * 25;
}

function getEvenPositions(count: number): number[] {
  if (count <= 1) {
    return [0];
  }

  return Array.from({ length: count }, (_, index) => (index / (count - 1)) * 100);
}

function finiteAbs(value: number): number {
  return Math.abs(finiteNumber(value));
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function formatScaleLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return String(Math.round(value));
}
