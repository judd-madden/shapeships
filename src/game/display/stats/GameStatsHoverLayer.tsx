import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import type { GameStatsTurnViewModel } from '../../client/gameSession/types';
import {
  getGameStatsFleetValueYPercent,
  getGameStatsHealthYPercent,
  getGameStatsTurnXPercent,
} from './gameStatsChartGeometry';
import type { GameStatsScale } from './gameStatsScales';

interface GameStatsHoverLayerProps {
  turns: GameStatsTurnViewModel[];
  hoveredTurnIndex: number | null;
  healthScale: GameStatsScale;
  fleetScale: GameStatsScale;
  healthFloor: number;
  headerHeightPx: number;
  turnColumnMinWidthPx: number;
  rowPaddingLeftPx: number;
  rowPaddingRightPx: number;
  graphInsetTopPx: number;
  graphInsetBottomPx: number;
  onHoveredTurnIndexChange: (hoveredTurnIndex: number | null) => void;
}

type HealthBubblePlacement = 'above' | 'below';
type FleetBubblePlacement = 'top' | 'bottom';

const HOVER_BAND_Z_INDEX = 2;
const HOVER_LABEL_Z_INDEX = 5;
const HOVER_HIT_Z_INDEX = 6;
const HEALTH_BUBBLE_EDGE_X_PX = 38;
const HEALTH_BUBBLE_GAP_PX = 8;
const FLEET_BUBBLE_EDGE_X_PX = 42;
const FLEET_BUBBLE_EDGE_Y_PX = 8;
const PILL_BASE_STYLE = {
  background: 'var(--shapeships-black)',
  borderRadius: 99,
  fontSize: 18,
  fontVariationSettings: "'wdth' 100",
  fontWeight: 700,
  lineHeight: '20px',
  padding: '1px 8px',
} satisfies CSSProperties;

export function GameStatsHoverLayer({
  turns,
  hoveredTurnIndex,
  healthScale,
  fleetScale,
  healthFloor,
  headerHeightPx,
  turnColumnMinWidthPx,
  rowPaddingLeftPx,
  rowPaddingRightPx,
  graphInsetTopPx,
  graphInsetBottomPx,
  onHoveredTurnIndexChange,
}: GameStatsHoverLayerProps) {
  const turnCount = Math.max(1, turns.length);
  const hoveredTurn =
    hoveredTurnIndex === null ? null : turns[hoveredTurnIndex] ?? null;
  const gridTemplateColumns = `${rowPaddingLeftPx}px repeat(${turnCount}, minmax(${turnColumnMinWidthPx}px, 1fr)) ${rowPaddingRightPx}px`;
  const gridTemplateRows = `${headerHeightPx}px repeat(4, minmax(0, 1fr))`;

  return (
    <>
      <HoverBand
        hoveredTurnIndex={hoveredTurn ? hoveredTurnIndex : null}
        gridTemplateColumns={gridTemplateColumns}
        gridTemplateRows={gridTemplateRows}
      />
      {hoveredTurn && hoveredTurnIndex !== null ? (
        <HoverLabels
          turn={hoveredTurn}
          turnIndex={hoveredTurnIndex}
          turnCount={turns.length}
          healthScale={healthScale}
          fleetScale={fleetScale}
          healthFloor={healthFloor}
          gridTemplateRows={gridTemplateRows}
          rowPaddingLeftPx={rowPaddingLeftPx}
          rowPaddingRightPx={rowPaddingRightPx}
          graphInsetTopPx={graphInsetTopPx}
          graphInsetBottomPx={graphInsetBottomPx}
        />
      ) : null}
      <HoverHitLayer
        turns={turns}
        hoveredTurnIndex={hoveredTurnIndex}
        gridTemplateColumns={gridTemplateColumns}
        gridTemplateRows={gridTemplateRows}
        onHoveredTurnIndexChange={onHoveredTurnIndexChange}
      />
    </>
  );
}

function HoverBand({
  hoveredTurnIndex,
  gridTemplateColumns,
  gridTemplateRows,
}: {
  hoveredTurnIndex: number | null;
  gridTemplateColumns: string;
  gridTemplateRows: string;
}) {
  if (hoveredTurnIndex === null) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 grid"
      style={{
        gridTemplateColumns,
        gridTemplateRows,
        zIndex: HOVER_BAND_Z_INDEX,
      }}
      aria-hidden="true"
    >
      <div
        style={{
          backgroundColor: 'rgb(255 255 255 / 0.1)',
          gridColumnStart: hoveredTurnIndex + 2,
          gridRow: '1 / -1',
        }}
      />
    </div>
  );
}

function HoverLabels({
  turn,
  turnIndex,
  turnCount,
  healthScale,
  fleetScale,
  healthFloor,
  gridTemplateRows,
  rowPaddingLeftPx,
  rowPaddingRightPx,
  graphInsetTopPx,
  graphInsetBottomPx,
}: {
  turn: GameStatsTurnViewModel;
  turnIndex: number;
  turnCount: number;
  healthScale: GameStatsScale;
  fleetScale: GameStatsScale;
  healthFloor: number;
  gridTemplateRows: string;
  rowPaddingLeftPx: number;
  rowPaddingRightPx: number;
  graphInsetTopPx: number;
  graphInsetBottomPx: number;
}) {
  const turnXPercent = getGameStatsTurnXPercent(turnIndex, turnCount);
  const viewerHealthYPercent = getGameStatsHealthYPercent(
    turn.viewer.healthEnd,
    healthScale,
    healthFloor,
  );
  const opponentHealthYPercent = getGameStatsHealthYPercent(
    turn.opponent.healthEnd,
    healthScale,
    healthFloor,
  );
  const healthLayouts = getHealthBubbleLayouts(
    turn.viewer.healthEnd,
    turn.opponent.healthEnd,
  );
  const viewerFleetYPercent = getGameStatsFleetValueYPercent(
    turn.viewer.fleetValueEnd,
    fleetScale,
  );
  const opponentFleetYPercent = getGameStatsFleetValueYPercent(
    turn.opponent.fleetValueEnd,
    fleetScale,
  );
  const fleetPlacement = getFleetBubblePlacement(
    viewerFleetYPercent,
    opponentFleetYPercent,
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 grid"
      style={{
        gridTemplateRows,
        zIndex: HOVER_LABEL_Z_INDEX,
      }}
      aria-hidden="true"
    >
      <HoverPlotArea
        gridRow="2"
        rowPaddingLeftPx={rowPaddingLeftPx}
        rowPaddingRightPx={rowPaddingRightPx}
        graphInsetTopPx={graphInsetTopPx}
        graphInsetBottomPx={graphInsetBottomPx}
      >
        <HealthHoverBubble
          healthEnd={turn.viewer.healthEnd}
          healthDelta={turn.viewer.healthDelta}
          totalColor="var(--shapeships-white)"
          xPercent={turnXPercent}
          yPercent={viewerHealthYPercent}
          placement={healthLayouts.viewerPlacement}
          xOffsetPx={healthLayouts.viewerXOffsetPx}
        />
        <HealthHoverBubble
          healthEnd={turn.opponent.healthEnd}
          healthDelta={turn.opponent.healthDelta}
          totalColor="var(--shapeships-grey-50)"
          xPercent={turnXPercent}
          yPercent={opponentHealthYPercent}
          placement={healthLayouts.opponentPlacement}
          xOffsetPx={healthLayouts.opponentXOffsetPx}
        />
      </HoverPlotArea>
      <HoverPlotArea
        gridRow="5"
        rowPaddingLeftPx={rowPaddingLeftPx}
        rowPaddingRightPx={rowPaddingRightPx}
        graphInsetTopPx={graphInsetTopPx}
        graphInsetBottomPx={graphInsetBottomPx}
      >
        <FleetValueHoverStack
          viewerValue={turn.viewer.fleetValueEnd}
          opponentValue={turn.opponent.fleetValueEnd}
          xPercent={turnXPercent}
          placement={fleetPlacement}
        />
      </HoverPlotArea>
    </div>
  );
}

function HoverPlotArea({
  gridRow,
  rowPaddingLeftPx,
  rowPaddingRightPx,
  graphInsetTopPx,
  graphInsetBottomPx,
  children,
}: {
  gridRow: string;
  rowPaddingLeftPx: number;
  rowPaddingRightPx: number;
  graphInsetTopPx: number;
  graphInsetBottomPx: number;
  children: ReactNode;
}) {
  return (
    <div
      className="relative min-h-0 min-w-0"
      style={{
        gridRow,
      }}
    >
      <div
        className="absolute"
        style={{
          bottom: graphInsetBottomPx,
          left: rowPaddingLeftPx,
          right: rowPaddingRightPx,
          top: graphInsetTopPx,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function HealthHoverBubble({
  healthEnd,
  healthDelta,
  totalColor,
  xPercent,
  yPercent,
  placement,
  xOffsetPx,
}: {
  healthEnd: number;
  healthDelta: number;
  totalColor: string;
  xPercent: number;
  yPercent: number;
  placement: HealthBubblePlacement;
  xOffsetPx: number;
}) {
  return (
    <div
      className="absolute whitespace-nowrap"
      style={{
        ...PILL_BASE_STYLE,
        left: getClampedLeftCss(xPercent, HEALTH_BUBBLE_EDGE_X_PX, xOffsetPx),
        top: formatPercent(yPercent),
        transform: getHealthBubbleTransform(placement),
      }}
    >
      <span style={{ color: totalColor }}>{formatWholeNumber(healthEnd)}</span>{' '}
      <span style={{ color: getHealthDeltaColor(healthDelta) }}>
        {formatHealthDelta(healthDelta)}
      </span>
    </div>
  );
}

function FleetValueHoverStack({
  viewerValue,
  opponentValue,
  xPercent,
  placement,
}: {
  viewerValue: number;
  opponentValue: number;
  xPercent: number;
  placement: FleetBubblePlacement;
}) {
  return (
    <div
      className="absolute flex flex-col items-center gap-[4px]"
      style={{
        left: getClampedLeftCss(xPercent, FLEET_BUBBLE_EDGE_X_PX),
        top:
          placement === 'bottom'
            ? `calc(100% - ${FLEET_BUBBLE_EDGE_Y_PX}px)`
            : FLEET_BUBBLE_EDGE_Y_PX,
        transform:
          placement === 'bottom'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, 0)',
      }}
    >
      <span
        className="whitespace-nowrap"
        style={{
          ...PILL_BASE_STYLE,
          color: 'var(--shapeships-pastel-blue)',
        }}
      >
        {formatWholeNumber(viewerValue)}
      </span>
      <span
        className="whitespace-nowrap"
        style={{
          ...PILL_BASE_STYLE,
          color: 'var(--shapeships-pastel-purple)',
        }}
      >
        {formatWholeNumber(opponentValue)}
      </span>
    </div>
  );
}

function HoverHitLayer({
  turns,
  hoveredTurnIndex,
  gridTemplateColumns,
  gridTemplateRows,
  onHoveredTurnIndexChange,
}: {
  turns: GameStatsTurnViewModel[];
  hoveredTurnIndex: number | null;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  onHoveredTurnIndexChange: (hoveredTurnIndex: number | null) => void;
}) {
  function handlePointerHover(
    event: PointerEvent<HTMLDivElement>,
    turnIndex: number,
  ) {
    if (event.pointerType === 'touch') {
      onHoveredTurnIndexChange(null);
      return;
    }

    if (hoveredTurnIndex !== turnIndex) {
      onHoveredTurnIndexChange(turnIndex);
    }
  }

  return (
    <div
      className="absolute inset-0 grid"
      style={{
        gridTemplateColumns,
        gridTemplateRows,
        pointerEvents: 'none',
        zIndex: HOVER_HIT_Z_INDEX,
      }}
      aria-hidden="true"
    >
      {turns.map((turn, index) => (
        <div
          key={turn.turnNumber}
          className="min-h-0 min-w-0"
          style={{
            gridColumnStart: index + 2,
            gridRow: '1 / -1',
            pointerEvents: 'auto',
            touchAction: 'pan-x',
          }}
          onPointerEnter={(event) => handlePointerHover(event, index)}
          onPointerMove={(event) => handlePointerHover(event, index)}
          onPointerDown={(event) => {
            if (event.pointerType === 'touch') {
              onHoveredTurnIndexChange(null);
            }
          }}
        />
      ))}
    </div>
  );
}

function getHealthBubbleLayouts(
  viewerHealthEnd: number,
  opponentHealthEnd: number,
): {
  viewerPlacement: HealthBubblePlacement;
  opponentPlacement: HealthBubblePlacement;
  viewerXOffsetPx: number;
  opponentXOffsetPx: number;
} {
  const viewerHealthValue = finiteNumber(viewerHealthEnd);
  const opponentHealthValue = finiteNumber(opponentHealthEnd);

  if (viewerHealthValue > opponentHealthValue) {
    return {
      viewerPlacement: 'above',
      opponentPlacement: 'below',
      viewerXOffsetPx: 0,
      opponentXOffsetPx: 0,
    };
  }

  if (opponentHealthValue > viewerHealthValue) {
    return {
      viewerPlacement: 'below',
      opponentPlacement: 'above',
      viewerXOffsetPx: 0,
      opponentXOffsetPx: 0,
    };
  }

  return {
    viewerPlacement: 'above',
    opponentPlacement: 'below',
    viewerXOffsetPx: 0,
    opponentXOffsetPx: 0,
  };
}

function getFleetBubblePlacement(
  viewerYPercent: number,
  opponentYPercent: number,
): FleetBubblePlacement {
  return (viewerYPercent + opponentYPercent) / 2 < 50 ? 'bottom' : 'top';
}

function getHealthBubbleTransform(placement: HealthBubblePlacement): string {
  if (placement === 'below') {
    return `translate(-50%, ${HEALTH_BUBBLE_GAP_PX}px)`;
  }

  return `translate(-50%, calc(-100% - ${HEALTH_BUBBLE_GAP_PX}px))`;
}

function getClampedLeftCss(
  xPercent: number,
  edgePx: number,
  xOffsetPx = 0,
): string {
  const percent = formatPercent(xPercent);
  const preferred =
    xOffsetPx === 0
      ? percent
      : `calc(${percent} ${xOffsetPx > 0 ? '+' : '-'} ${Math.abs(xOffsetPx)}px)`;

  return `clamp(${edgePx}px, ${preferred}, calc(100% - ${edgePx}px))`;
}

function getHealthDeltaColor(delta: number): string {
  const roundedDelta = roundFinite(delta);

  if (roundedDelta > 0) {
    return 'var(--shapeships-pastel-green)';
  }

  if (roundedDelta < 0) {
    return 'var(--shapeships-pastel-red)';
  }

  return 'var(--shapeships-grey-50)';
}

function formatHealthDelta(delta: number): string {
  const roundedDelta = roundFinite(delta);

  if (roundedDelta > 0) {
    return `+${roundedDelta}`;
  }

  if (roundedDelta < 0) {
    return String(roundedDelta);
  }

  return '\u00b10';
}

function formatWholeNumber(value: number): string {
  return String(roundFinite(value));
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function roundFinite(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function formatPercent(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, '')}%`;
}
