/**
 * Top HUD
 * Top bar with player names, species, timers, and ready status
 * NO LOGIC - displays view-model data only (Pass 1.25)
 * 
 * PLAYER-RELATIVE ORIENTATION:
 * - Local player (Me) is ALWAYS on the LEFT
 * - Opponent is ALWAYS on the RIGHT
 */

import type { HudViewModel } from '../../client/useGameSession';
import { FitSingleLineText } from '../../../components/ui/primitives/layout/FitSingleLineText';
import { ClockWithIncrement } from '../shared/ClockWithIncrement';

interface TopHudProps {
  vm: HudViewModel;
}

function OnlineStatus({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="relative shrink-0 size-[12px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Online Status">
          <circle 
            cx="6" 
            cy="6" 
            fill={isOnline ? 'var(--shapeships-green)' : 'var(--shapeships-grey-50)'}
            id="Online Status_2" 
            r="6" 
          />
        </g>
      </svg>
    </div>
  );
}

interface PlayerHeaderProps {
  vm: HudViewModel;
  side: 'left' | 'right';
}

function PlayerHeader({ vm, side }: PlayerHeaderProps) {
  const isLeft = side === 'left';
  const name = isLeft ? vm.p1Name : vm.p2Name;
  const species = isLeft ? vm.p1Species : vm.p2Species;
  const isOnline = isLeft ? vm.p1IsOnline : vm.p2IsOnline;
  const isReady = isLeft ? vm.p1IsReady : vm.p2IsReady;
  const statusText = isLeft ? vm.p1StatusText : vm.p2StatusText;
  const statusTone = isLeft ? vm.p1StatusTone : vm.p2StatusTone;

  return (
    <div
        className={`relative z-30 row-start-1 flex flex-row min-w-0 items-start gap-[8px] min-[1400px]:gap-[12px] min-[1920px]:gap-[20px] [--ss-header-track-gap:20px] min-[1400px]:[--ss-header-track-gap:28px] min-[1920px]:[--ss-header-track-gap:40px] [--ss-header-inset:calc(var(--ss-board-center-width)_/_2_+_8px_-_52px_-_var(--ss-header-track-gap))] ${
          isLeft
            ? 'col-start-1 -mr-[var(--ss-header-inset)] justify-end'
            : 'col-start-3 -ml-[var(--ss-header-inset)] justify-start'
        }`}
        data-name={isLeft ? 'Me Header' : 'Opponent Header'}
      >
      <div
        className={`h-[36px] w-[136px] max-w-full shrink-0 min-[1400px]:h-[42px] min-[1400px]:w-[164px] min-[1920px]:h-[50px] min-[1920px]:w-[200px]  ${
          isLeft ? 'order-1' : 'order-3'
        }`}
      >
        {statusTone !== 'hidden' ? (
          <div className="flex size-full items-center justify-center mt-[4px] rounded-[10px] bg-[var(--shapeships-grey-90)] px-[8px] min-[1400px]:px-[12px] min-[1920px]:px-[20px]">
            <FitSingleLineText
              text={statusText ?? ''}
              maxFontSize={18}
              minFontSize={10}
              align="center"
              className={`w-full font-black leading-normal text-[12px] min-[1400px]:text-[14px] min-[1920px]:text-[18px] ${
                statusTone === 'ready' ? 'text-[var(--shapeships-pastel-green)]' : 'text-white'
              }`}
            />
          </div>
        ) : null}
      </div>

      <div
        className={`order-2 flex h-[36px] w-[7ch] shrink-0 mt-[4px] items-center justify-center whitespace-nowrap font-bold text-[16px] leading-normal tabular-nums min-[1400px]:h-[42px] min-[1400px]:text-[20px] min-[1920px]:h-[50px] min-[1920px]:text-[28px]  ${
          isReady ? 'text-[var(--shapeships-grey-50)]' : 'text-[var(--shapeships-grey-20)]'
        }`}
      >
        <ClockWithIncrement
          clock={isLeft ? vm.p1Clock : vm.p2Clock}
          incrementSeconds={vm.clockIncrementSeconds}
          scopeKey={vm.clockIncrementScopeKey}
          turnNumber={vm.clockIncrementTurnNumber}
          variant="desktop"
        />
      </div>

      <div
        className={`min-w-0 max-w-[160px] flex-1 min-[1400px]:max-w-[200px] min-[1920px]:max-w-[300px]  ${
          isLeft ? 'order-3' : 'order-1'
        }`}
      >
        <div className={`grid h-[36px] w-full min-w-0 items-center gap-x-[8px] min-[1400px]:h-[42px] min-[1920px]:h-[50px]  ${
          isLeft ? 'grid-cols-[minmax(0,1fr)_12px]' : 'grid-cols-[12px_minmax(0,1fr)]'
        }`}>
          <div className={`relative row-start-1 min-w-0 ${isLeft ? 'col-start-1' : 'col-start-2'}`}>
            <FitSingleLineText
              text={name}
              maxFontSize={36}
              align={isLeft ? 'right' : 'left'}
              className="w-full min-w-0 font-normal leading-[1] text-[16px] text-white min-[1400px]:text-[24px] min-[1920px]:text-[36px]"
            />
            {/* Anchor species to the fitted name box, not the fixed control slot. */}
            <p className={`absolute inset-x-0 top-full truncate text-[10px] font-normal capitalize leading-[1] text-white min-[1400px]:text-[12px] min-[1920px]:text-[15px] ${isLeft ? 'text-right' : 'text-left'}`} title={species}>
              {species}
            </p>
          </div>
          <div className={`row-start-1 ${isLeft ? 'col-start-2' : 'col-start-1'}`}>
            <OnlineStatus isOnline={isOnline} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Fragment children occupy the same grid columns as the fleets beneath them.
export function TopHud({ vm }: TopHudProps) {
  return (
    <>
      <PlayerHeader vm={vm} side="left" />
      <PlayerHeader vm={vm} side="right" />
    </>
  );
}
