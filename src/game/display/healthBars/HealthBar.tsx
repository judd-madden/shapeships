import type { CSSProperties } from 'react';
import {
  calculateHealthBarLegend,
  type HealthBarOrientation,
  type PreparedHealthBarScale,
} from './healthBarScale';
import {
  calculateHealthBarGeometry, healthBarAxisLength, healthBarValuePosition,
  type HealthBarPresentationState, type HealthBarSide,
} from './healthBarPresentation';

interface HealthBarSharedProps {
  readonly scale: Readonly<PreparedHealthBarScale>;
  readonly orientation: HealthBarOrientation;
  /** Usable inner length; the track adds 2px padding at either end. */
  readonly axisLength: number;
}

export interface HealthBarProps extends HealthBarSharedProps {
  readonly side: HealthBarSide;
  readonly state: HealthBarPresentationState;
  readonly label: string;
}

export function HealthBar({ scale, side, state, orientation, axisLength, label }: HealthBarProps) {
  const geometry = calculateHealthBarGeometry(scale, side, state, orientation, axisLength);
  const desktop = orientation === 'desktop';
  const cap = side === 'left' ? scale.leftCap : scale.rightCap;
  const description = [
    `${label}: displayed health ${state.health}`,
    cap.value === null ? 'maximum unknown' : `maximum ${cap.value}`,
    state.red ? `red interval ${state.red.from} to ${state.red.to}` : null,
    state.green ? `green interval ${state.green.from} to ${state.green.to}` : null,
  ].filter(Boolean).join('; ');
  const markerStyle = (position: number, size: number): CSSProperties => desktop
    ? { left: side === 'left' ? 30 : -2 - size, top: position - size / 2, width: size, height: size }
    : { left: position - size / 2, top: side === 'left' ? -2 - size : 16, width: size, height: size };

  return (
    <div role="img" aria-label={description} data-health-bar={side} data-orientation={orientation}
      className="relative shrink-0 overflow-visible"
      style={{ width: geometry.width, height: geometry.height, background: desktop
        ? 'linear-gradient(to bottom, var(--shapeships-grey-90) 0%, #101010 80%, #101010 100%)'
        : 'var(--shapeships-grey-90)' }}>
      {geometry.white && <div aria-hidden="true" data-health-layer="white" className="absolute bg-white" style={{ ...geometry.white }} />}
      {geometry.red && <div aria-hidden="true" data-health-layer="red" className="absolute bg-[var(--shapeships-red)]" style={{ ...geometry.red }} />}
      {geometry.green && <div aria-hidden="true" data-health-layer="green" className="absolute bg-[var(--shapeships-green)]" style={{ ...geometry.green }} />}
      {geometry.capPosition !== null && (
        <span aria-hidden="true" data-health-marker="cap" className="absolute text-[var(--shapeships-grey-50)]"
          style={markerStyle(geometry.capPosition, 4)}>
          <svg width="4" height="4" viewBox="0 0 4 4">
            <path d={desktop ? 'M0 2H4' : 'M2 0V4'} stroke="currentColor" />
          </svg>
        </span>
      )}
      {geometry.compressionPosition !== null && (
        <span aria-hidden="true" data-health-marker="compression" className="absolute text-[var(--shapeships-grey-50)]"
          style={markerStyle(geometry.compressionPosition, 6)}>
          <svg width="6" height="6" viewBox="0 0 6 6">
            <path d="M0 4L2 0M3 6L5 2" stroke="currentColor" />
          </svg>
        </span>
      )}
      <div aria-hidden="true" data-health-marker="zero" className="absolute bg-white" style={{ ...geometry.zero }} />
    </div>
  );
}

export function HealthBarLegend({ scale, orientation, axisLength }: HealthBarSharedProps) {
  const desktop = orientation === 'desktop';
  const length = healthBarAxisLength(axisLength);
  const labels = calculateHealthBarLegend(scale, { orientation, axisLength: length });
  return (
    <div aria-label="Shared health scale" data-health-legend={orientation}
      className="relative shrink-0 overflow-visible font-normal leading-none text-[var(--shapeships-grey-50)]"
      style={{ width: desktop ? 56 : length + 4, height: desktop ? length + 4 : 18, fontSize: desktop ? 12 : 10 }}>
      {labels.map((tick) => (
        <span key={tick.value} data-health-tick={tick.value} className="absolute whitespace-nowrap"
          style={desktop
            ? { top: healthBarValuePosition(scale, tick.value, orientation, length)!, left: '50%', transform: 'translate(-50%, -50%)' }
            : { left: healthBarValuePosition(scale, tick.value, orientation, length)!, top: '50%', transform: 'translate(-50%, -50%)' }}>
          {tick.label}
        </span>
      ))}
    </div>
  );
}

export interface HealthBarPairProps extends HealthBarSharedProps {
  readonly left: HealthBarPresentationState;
  readonly right: HealthBarPresentationState;
  readonly leftLabel: string;
  readonly rightLabel: string;
}

export function HealthBarPair({ left, right, leftLabel, rightLabel, ...shared }: HealthBarPairProps) {
  return (
    <div data-health-pair={shared.orientation}
      className={shared.orientation === 'desktop' ? 'flex items-start' : 'flex flex-col items-start'}>
      <HealthBar {...shared} side="left" state={left} label={leftLabel} />
      <HealthBarLegend {...shared} />
      <HealthBar {...shared} side="right" state={right} label={rightLabel} />
    </div>
  );
}
