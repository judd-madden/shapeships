import type { CSSProperties } from 'react';
import type {
  HealthResolutionPresentationVm,
  HealthResolutionSideVm,
} from '../../../client/gameSession/types';

interface HealthResolutionPanelProps {
  vm: HealthResolutionPresentationVm;
  layout?: 'desktop' | 'mobile';
}

const HEALTH_RESOLUTION_MOTION = {
  totalMs: 4000,
  exitEndMs: 3940,
  reverseScale: 0.8,

  card: {
    startMs: 0,
    durationMs: 360,
  },

  digit: {
    startMs: 360,
    durationMs: 300,
    staggerMs: 70,
  },

  turnLabel: {
    startMs: 470,
    durationMs: 180,
  },

  playerName: {
    startMs: 800,
    durationMs: 300,
  },

  playerOutcome: {
    startMs: 900,
    durationMs: 300,
  },

  movementPx: 3,
  enterEase: 'cubic-bezier(0.16, 1, 0.3, 1)',
  exitEase: 'cubic-bezier(0.7, 0, 0.84, 0)',
} as const;

type HealthResolutionMotionStyle = CSSProperties &
  Record<
    | '--ss-hr-enter-delay'
    | '--ss-hr-enter-duration'
    | '--ss-hr-exit-delay'
    | '--ss-hr-exit-duration'
    | '--ss-hr-enter-ease'
    | '--ss-hr-exit-ease',
    string
  >;

type HealthResolutionRootStyle = CSSProperties & {
  '--ss-hr-movement': string;
};

type HealthResolutionNumberStyle = CSSProperties & {
  '--ss-hr-digit-tracking': string;
};

function getMotionStyle(forwardStartMs: number, forwardDurationMs: number): HealthResolutionMotionStyle {
  const reverseDurationMs = forwardDurationMs * HEALTH_RESOLUTION_MOTION.reverseScale;
  const reverseStartMs =
    HEALTH_RESOLUTION_MOTION.exitEndMs -
    (forwardStartMs + forwardDurationMs) * HEALTH_RESOLUTION_MOTION.reverseScale;

  return {
    '--ss-hr-enter-delay': `${forwardStartMs}ms`,
    '--ss-hr-enter-duration': `${forwardDurationMs}ms`,
    '--ss-hr-exit-delay': `${reverseStartMs}ms`,
    '--ss-hr-exit-duration': `${reverseDurationMs}ms`,
    '--ss-hr-enter-ease': HEALTH_RESOLUTION_MOTION.enterEase,
    '--ss-hr-exit-ease': HEALTH_RESOLUTION_MOTION.exitEase,
  };
}

function getValueColor(side: HealthResolutionSideVm): string {
  switch (side.valueTone) {
    case 'damage':
      return 'var(--shapeships-pastel-red)';
    case 'heal':
      return 'var(--shapeships-pastel-green)';
    case 'neutral':
    default:
      return 'var(--shapeships-grey-50)';
  }
}

type PlayerMotion = 'desktop-left' | 'desktop-right';

function OutcomeLine({
  side,
  layout,
  motion,
}: {
  side: HealthResolutionSideVm;
  layout: 'desktop' | 'mobile';
  motion: PlayerMotion;
}) {
  return (
    <p
      className={`ss-health-resolution-player-line ss-health-resolution-player-line--${motion} max-w-full font-['Roboto'] font-normal leading-none text-white ${
        layout === 'mobile'
          ? 'whitespace-normal text-[22px]'
          : 'whitespace-nowrap text-[clamp(26px,2.9vw,44px)]'
      }`}
      style={{
        ...getMotionStyle(
          HEALTH_RESOLUTION_MOTION.playerOutcome.startMs,
          HEALTH_RESOLUTION_MOTION.playerOutcome.durationMs,
        ),
        fontVariationSettings: "'wdth' 100",
      }}
    >
      <span>{side.prefixText}</span>
      <span className="font-bold" style={{ color: getValueColor(side) }}>
        {side.valueText}
      </span>
      <span>{side.suffixText}</span>
    </p>
  );
}

function PlayerResult({
  side,
  layout,
  alignment,
  motion,
}: {
  side: HealthResolutionSideVm;
  layout: 'desktop' | 'mobile';
  alignment: 'left' | 'right';
  motion: PlayerMotion;
}) {
  const isMobile = layout === 'mobile';

  return (
    <div
      className={`flex w-full min-w-0 max-w-full flex-col ${
        isMobile ? 'gap-[4px]' : 'gap-[24px]'
      } ${alignment === 'right' ? 'items-end text-right' : 'items-start text-left'}`}
    >
      <p
        className={`ss-health-resolution-player-line ss-health-resolution-player-line--${motion} w-full truncate font-['Roboto'] font-medium leading-none text-white ${
          isMobile ? 'text-[14px]' : 'text-[clamp(18px,1.7vw,26px)]'
        }`}
        style={{
          ...getMotionStyle(
            HEALTH_RESOLUTION_MOTION.playerName.startMs,
            HEALTH_RESOLUTION_MOTION.playerName.durationMs,
          ),
          fontVariationSettings: "'wdth' 100",
        }}
      >
        {side.nameText}
      </p>
      <OutcomeLine side={side} layout={layout} motion={motion} />
    </div>
  );
}

function TurnCard({
  turnNumber,
  layout,
  isTerminalTurn,
}: {
  turnNumber: number;
  layout: 'desktop' | 'mobile';
  isTerminalTurn: boolean;
}) {
  const digits = String(turnNumber).split('');
  const isTerminalVariant = isTerminalTurn;
  const usesTeenNumberAdjustment = turnNumber >= 10 && turnNumber <= 19;
  const numberStyle: HealthResolutionNumberStyle = {
    '--ss-hr-digit-tracking': usesTeenNumberAdjustment ? '-0.12em' : '-0.04em',
    ...(usesTeenNumberAdjustment
      ? { transform: `translateX(${layout === 'mobile' ? '-6px' : '-12px'})` }
      : {}),
  };
  const cardMotionStyle: HealthResolutionMotionStyle = {
    ...getMotionStyle(
      HEALTH_RESOLUTION_MOTION.card.startMs,
      HEALTH_RESOLUTION_MOTION.card.durationMs,
    ),
    ...(isTerminalVariant
      ? {
          background: 'var(--shapeships-black)',
          boxShadow: 'inset 0 0 0 3px var(--shapeships-white)',
        }
      : {}),
  };
  const turnLabelMotionStyle = getMotionStyle(
    HEALTH_RESOLUTION_MOTION.turnLabel.startMs,
    HEALTH_RESOLUTION_MOTION.turnLabel.durationMs,
  );

  const content = (
    <>
      <div
        aria-hidden="true"
        className="ss-health-resolution-card-background"
        style={cardMotionStyle}
      />
      <p
        className={`ss-health-resolution-turn-label relative z-10 font-['Roboto'] font-medium leading-none ${
          layout === 'mobile' ? 'text-[13px]' : 'text-[clamp(18px,1.7vw,26px)]'
        }`}
        style={turnLabelMotionStyle}
      >
        Turn
      </p>
      <p
        className={`ss-health-resolution-number-row relative z-10 flex font-['Roboto'] font-black leading-none ${
          layout === 'mobile' ? 'text-[75px]' : 'text-[clamp(90px,9.8vw,150px)]'
        }`}
        style={numberStyle}
      >
        {digits.map((digit, digitIndex) => {
          const digitForwardStartMs =
            HEALTH_RESOLUTION_MOTION.digit.startMs +
            digitIndex * HEALTH_RESOLUTION_MOTION.digit.staggerMs;

          return (
            <span
              key={`${digitIndex}-${digit}`}
              className="ss-health-resolution-digit"
              style={getMotionStyle(
                digitForwardStartMs,
                HEALTH_RESOLUTION_MOTION.digit.durationMs,
              )}
            >
              {digit}
            </span>
          );
        })}
      </p>
    </>
  );

  if (layout === 'mobile') {
    return (
      <div
        className={`relative flex min-w-[110px] flex-col items-center justify-center gap-0 rounded-[10px] px-[20px] py-[15px] text-center ${
          isTerminalVariant ? 'text-white' : 'text-black'
        }`}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-0 rounded-[20px] text-center ${
        isTerminalVariant ? 'text-white' : 'text-black'
      }`}
      style={{
        minWidth: 'clamp(160px, 16vw, 250px)',
        paddingInline: 'clamp(20px, 2.6vw, 40px)',
        paddingBlock: 'clamp(20px, 2vw, 30px)',
      }}
    >
      {content}
    </div>
  );
}

export function HealthResolutionPanel({ vm, layout = 'desktop' }: HealthResolutionPanelProps) {
  const rootStyle: HealthResolutionRootStyle = {
    '--ss-hr-movement': `${HEALTH_RESOLUTION_MOTION.movementPx}px`,
  };

  if (layout === 'mobile') {
    return (
      <div
        className="relative flex size-full items-center justify-center overflow-hidden bg-black px-[12px]"
        style={rootStyle}
      >
        <div className="grid w-full max-w-[420px] grid-cols-[minmax(0,1fr)_minmax(110px,auto)_minmax(0,1fr)] items-center gap-[16px]">
          <div className="w-full min-w-0">
            <PlayerResult
              side={vm.left}
              layout="mobile"
              alignment="right"
              motion="desktop-left"
            />
          </div>

          <TurnCard
            turnNumber={vm.displayTurnNumber}
            layout="mobile"
            isTerminalTurn={vm.isTerminalTurn}
          />

          <div className="w-full min-w-0">
            <PlayerResult
              side={vm.right}
              layout="mobile"
              alignment="left"
              motion="desktop-right"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex size-full items-center justify-center overflow-hidden rounded-[8px] bg-black px-[clamp(12px,2vw,40px)]"
      style={rootStyle}
    >
      <div
        className="grid w-full max-w-[1300px] items-center"
        style={{
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          columnGap: 'clamp(20px, 3vw, 50px)',
        }}
      >
        <div className="w-full min-w-0">
          <PlayerResult
            side={vm.left}
            layout="desktop"
            alignment="right"
            motion="desktop-left"
          />
        </div>

        <TurnCard
          turnNumber={vm.displayTurnNumber}
          layout="desktop"
          isTerminalTurn={vm.isTerminalTurn}
        />

        <div className="w-full min-w-0">
          <PlayerResult
            side={vm.right}
            layout="desktop"
            alignment="left"
            motion="desktop-right"
          />
        </div>
      </div>
    </div>
  );
}
