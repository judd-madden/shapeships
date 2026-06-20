import type { CSSProperties, ReactNode } from 'react';
import type { GameStatsViewModel } from '../../client/gameSession/types';
import {
  buildFleetValueScale,
  buildHealthScale,
  buildPressureScale,
  type GameStatsScale,
} from './gameStatsScales';
import {
  GameStatsSummaryColumn,
  type GameStatsSummaryGroup,
} from './GameStatsSummaryColumn';

interface GameStatsBoardProps {
  gameStats: GameStatsViewModel;
  closeControl?: ReactNode;
}

interface StatsRowConfig {
  key: string;
  summaryGroups: [GameStatsSummaryGroup, GameStatsSummaryGroup];
  scale: GameStatsScale;
  showZeroRule?: boolean;
}

const HEADER_HEIGHT_PX = 45;
const SUMMARY_WIDTH_PX = 190;
const AXIS_GUTTER_WIDTH_PX = 56;
const TURN_COLUMN_MIN_WIDTH_PX = 44;
const TURN_NUMBER_INNER_WIDTH_PX = 25;
const ROW_PADDING_LEFT_PX = 2;
const ROW_PADDING_RIGHT_PX = 40;
const MAJOR_ROW_GAP_PX = 0;
const GRAPH_INSET_TOP_PX = 20;
const GRAPH_INSET_BOTTOM_PX = 20;
const ROW_GRADIENT =
  'linear-gradient( #141414 0%, #14141400 100%)';

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function GameStatsBoard({ gameStats, closeControl }: GameStatsBoardProps) {
  const healthScale = buildHealthScale();
  const pressureScale = buildPressureScale(gameStats.turns);
  const fleetScale = buildFleetValueScale(gameStats.turns);
  const turnCount = Math.max(1, gameStats.turns.length);
  const turnContentMinWidth =
    ROW_PADDING_LEFT_PX + ROW_PADDING_RIGHT_PX + turnCount * TURN_COLUMN_MIN_WIDTH_PX;
  const scrollContentStyle = {
    minWidth: `max(100%, ${turnContentMinWidth}px)`,
    gridTemplateRows: `${HEADER_HEIGHT_PX}px repeat(4, minmax(0, 1fr))`,
    rowGap: MAJOR_ROW_GAP_PX,
  } satisfies CSSProperties;

  const rowConfigs: StatsRowConfig[] = [
    {
      key: 'health',
      summaryGroups: [
        {
          label: gameStats.labels.viewerHealth,
          value: gameStats.summary.viewer.finalHealth,
          note: 'final',
          color: 'var(--shapeships-white)',
        },
        {
          label: gameStats.labels.opponentHealth,
          value: gameStats.summary.opponent.finalHealth,
          note: 'final',
          color: 'var(--shapeships-grey-50)',
        },
      ],
      scale: healthScale,
    },
    {
      key: 'viewerHealingOpponentDamage',
      summaryGroups: [
        {
          label: gameStats.labels.viewerHealing,
          value: gameStats.summary.viewer.totalHealing,
          note: 'total',
          color: 'var(--shapeships-green)',
        },
        {
          label: gameStats.labels.opponentDamage,
          value: gameStats.summary.opponent.totalDamage,
          note: 'total',
          color: 'var(--shapeships-pastel-red)',
        },
      ],
      scale: pressureScale,
      showZeroRule: true,
    },
    {
      key: 'viewerDamageOpponentHealing',
      summaryGroups: [
        {
          label: gameStats.labels.viewerDamage,
          value: gameStats.summary.viewer.totalDamage,
          note: 'total',
          color: 'var(--shapeships-orange)',
        },
        {
          label: gameStats.labels.opponentHealing,
          value: gameStats.summary.opponent.totalHealing,
          note: 'total',
          color: 'var(--shapeships-pastel-green)',
        },
      ],
      scale: pressureScale,
      showZeroRule: true,
    },
    {
      key: 'fleetValue',
      summaryGroups: [
        {
          label: gameStats.labels.viewerFleetValue,
          value: gameStats.summary.viewer.finalFleetValue,
          note: 'final',
          color: 'var(--shapeships-pastel-blue)',
        },
        {
          label: gameStats.labels.opponentFleetValue,
          value: gameStats.summary.opponent.finalFleetValue,
          note: 'final',
          color: 'var(--shapeships-pastel-purple)',
        },
      ],
      scale: fleetScale,
    },
  ];

  return (
    <div
      className="grid h-full min-h-0 w-full min-w-0 overflow-hidden font-['Roboto']"
      style={{
        gridTemplateColumns: `${SUMMARY_WIDTH_PX}px ${AXIS_GUTTER_WIDTH_PX}px minmax(0, 1fr)`,
        gridTemplateRows: `${HEADER_HEIGHT_PX}px repeat(4, minmax(0, 1fr))`,
        rowGap: MAJOR_ROW_GAP_PX,
      }}
    >
      <HeaderSummaryCell />
      <HeaderTurnCell />

      <div
        className="col-start-3 row-start-1 row-end-6 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden"
        data-name="Game Stats Shared Turn Scroll"
      >
        <div
          className="grid h-full min-h-0"
          style={scrollContentStyle}
        >
          <TurnHeaderRow turns={gameStats.turns} />
          {rowConfigs.map((rowConfig, index) => (
            <TurnGraphRow
              key={rowConfig.key}
              rowIndex={index}
              turnCount={turnCount}
              scale={rowConfig.scale}
              showZeroRule={rowConfig.showZeroRule === true}
            />
          ))}
        </div>
      </div>

      {rowConfigs.map((rowConfig, index) => (
        <StatsFixedRowCells
          key={rowConfig.key}
          rowIndex={index}
          config={rowConfig}
        />
      ))}

      {closeControl ? (
        <div className="pointer-events-none absolute right-[8px] top-[1px] z-10 flex h-[42px] items-center justify-center">
          <div className="pointer-events-auto">{closeControl}</div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderSummaryCell() {
  return (
    <div className="col-start-1 row-start-1 flex min-w-0 items-center pl-[30px]">
      <h2
        className="truncate text-[18px] font-bold leading-none text-[var(--shapeships-white)]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        GAME STATS
      </h2>
    </div>
  );
}

function HeaderTurnCell() {
  return (
    <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end pr-[8px]">
      <span
        className="text-[18px] font-medium leading-none text-[var(--shapeships-white)]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Turn
      </span>
    </div>
  );
}

function TurnHeaderRow({ turns }: { turns: GameStatsViewModel['turns'] }) {
  return (
    <div
      className="grid min-h-0"
      style={{
        gridTemplateColumns: `${ROW_PADDING_LEFT_PX}px repeat(${Math.max(
          1,
          turns.length,
        )}, minmax(${TURN_COLUMN_MIN_WIDTH_PX}px, 1fr)) ${ROW_PADDING_RIGHT_PX}px`,
      }}
    >
      <div aria-hidden="true" />
      {turns.map((turn) => (
        <div
          key={turn.turnNumber}
          className="flex min-w-0 items-center justify-center"
        >
          <div
            className="flex items-center justify-center text-[18px] font-bold leading-none text-[var(--shapeships-white)]"
            style={{
              width: TURN_NUMBER_INNER_WIDTH_PX,
              fontVariationSettings: "'wdth' 100",
            }}
          >
            {turn.turnNumber}
          </div>
        </div>
      ))}
      <div aria-hidden="true" />
    </div>
  );
}

function StatsFixedRowCells({
  rowIndex,
  config,
}: {
  rowIndex: number;
  config: StatsRowConfig;
}) {
  const rowStart = rowIndex + 2;

  return (
    <>
      <div
        className={cx(
          'col-start-1 min-h-0 min-w-0',
        )}
        style={{
          gridRowStart: rowStart,
          background: ROW_GRADIENT,
        }}
      >
        <GameStatsSummaryColumn groups={config.summaryGroups} />
      </div>
      <div
        className={cx(
          'col-start-2 min-h-0 min-w-0',
        )}
        style={{
          gridRowStart: rowStart,
          background: ROW_GRADIENT,
        }}
      >
        <AxisLegend scale={config.scale} />
      </div>
    </>
  );
}

function AxisLegend({ scale }: { scale: GameStatsScale }) {
  return (
    <div
      className="relative h-full min-h-0 overflow-hidden pr-[6px]"
      style={{
        paddingTop: GRAPH_INSET_TOP_PX,
        paddingBottom: GRAPH_INSET_BOTTOM_PX,
      }}
      aria-hidden="true"
    >
      <div className="relative h-full">
        {scale.labels.map((label, index) => (
          <span
            key={`${label}:${index}`}
            className="absolute right-0 whitespace-nowrap text-right text-[12px] font-medium leading-none text-[var(--shapeships-white)]"
            style={{
              top: `${scale.positions[index] ?? 0}%`,
              transform: 'translateY(-50%)',
              fontVariationSettings: "'wdth' 100",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TurnGraphRow({
  rowIndex,
  turnCount,
  scale,
  showZeroRule,
}: {
  rowIndex: number;
  turnCount: number;
  scale: GameStatsScale;
  showZeroRule: boolean;
}) {
  return (
    <div
      className={cx(
        'relative min-h-0 min-w-0',
      )}
      style={{
        background: ROW_GRADIENT,
      }}
    >
      <div
        className="pointer-events-none absolute left-0 w-[2px] bg-[var(--shapeships-grey-70)]"
        style={{
          top: GRAPH_INSET_TOP_PX,
          bottom: GRAPH_INSET_BOTTOM_PX,
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          top: GRAPH_INSET_TOP_PX,
          bottom: GRAPH_INSET_BOTTOM_PX,
          left: ROW_PADDING_LEFT_PX,
          right: ROW_PADDING_RIGHT_PX,
        }}
        aria-hidden="true"
      >
        {scale.positions.map((position, index) => {
          const isZeroRule = showZeroRule && index === 2;

          return (
            <div
              key={`${position}:${index}`}
              className={cx(
                'absolute left-0 right-0 bg-[var(--shapeships-grey-90)]',
                isZeroRule ? 'h-[2px]' : 'h-px',
              )}
              style={{
                top: `${position}%`,
                transform: 'translateY(-50%)',
              }}
            />
          );
        })}
      </div>
      <div
        className="grid h-full min-h-0"
        style={{
          gridTemplateColumns: `repeat(${turnCount}, minmax(${TURN_COLUMN_MIN_WIDTH_PX}px, 1fr))`,
          padding: `${GRAPH_INSET_TOP_PX}px ${ROW_PADDING_RIGHT_PX}px ${GRAPH_INSET_BOTTOM_PX}px ${ROW_PADDING_LEFT_PX}px`,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: turnCount }, (_, index) => (
          <div key={index} className="min-w-0" />
        ))}
      </div>
    </div>
  );
}
