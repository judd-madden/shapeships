/**
 * Top HUD
 * Top bar with player names, species, timers, and ready status
 * NO LOGIC - displays view-model data only (Pass 1.25)
 * 
 * PLAYER-RELATIVE ORIENTATION:
 * - Local player (Me) is ALWAYS on the LEFT
 * - Opponent is ALWAYS on the RIGHT
 */

import type React from 'react';
import type { HudViewModel } from '../../client/useGameSession';

interface TopHudProps {
  vm: HudViewModel;
}

function StatusWrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="bg-[#212121] h-[50px] relative rounded-[10px] shrink-0 w-full">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center px-[20px] py-[19px] relative size-full">
          {children}
        </div>
      </div>
    </div>
  );
}

function OnlineStatus({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="relative shrink-0 size-[12px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Online Status">
          <circle 
            cx="6" 
            cy="6" 
            fill={isOnline ? '#00BD13' : '#888'} 
            id="Online Status_2" 
            r="6" 
          />
        </g>
      </svg>
    </div>
  );
}

export function TopHud({ vm }: TopHudProps) {
  return (
    <div
      className="content-stretch flex items-start justify-between max-w-[1120px] relative shrink-0 w-full"
      data-name="Top Hud"
    >
      {/* Me Status and Time */}
      <div
        className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-[200px]"
        data-name="Me Status and Time"
      >
        {vm.p1StatusTone !== 'hidden' && (
          <StatusWrapper>
            <p
              className={`font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[18px] text-nowrap ${
                vm.p1StatusTone === 'ready' ? 'text-[#9cff84]' : 'text-white'
              }`}
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {vm.p1StatusText}
            </p>
          </StatusWrapper>
        )}
        <p
          className={`font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[28px] text-center w-full ${
            vm.p1IsReady ? 'text-[#888]' : 'text-[#d4d4d4]'
          }`}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {vm.p1Clock}
        </p>
      </div>

      {/* Player Names */}
      <div
        className="content-stretch flex gap-[79px] items-start justify-center relative shrink-0 w-[595px]"
        data-name="Player Names"
      >
        {/* Me Name Species */}
        <div
          className="basis-0 content-stretch flex flex-col gap-px grow items-end min-h-px min-w-px relative shrink-0"
          data-name="Me Name Species"
        >
          <div
            className="content-stretch flex gap-[8px] items-center justify-end relative shrink-0 w-full"
            data-name="Me Name"
          >
            <OnlineStatus isOnline={vm.p1IsOnline} />
            <p
              className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[36px] text-nowrap text-right text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {vm.p1Name}
            </p>
          </div>
          <p
            className="capitalize font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[15px] text-right text-white w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {vm.p1Species}
          </p>
        </div>

        {/* Opponent Name Species */}
        <div
          className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px relative shrink-0"
          data-name="Opponent Name Species"
        >
          <div
            className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full"
            data-name="Opponent Name"
          >
            <p
              className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[36px] text-nowrap text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {vm.p2Name}
            </p>
            <OnlineStatus isOnline={vm.p2IsOnline} />
          </div>
          <p
            className="capitalize font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[15px] text-white w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {vm.p2Species}
          </p>
        </div>
      </div>

      {/* Opponent Status and Time */}
      <div
        className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-[200px]"
        data-name="Opponent Status and Time"
      >
        {vm.p2StatusTone !== 'hidden' && (
          <StatusWrapper>
            <p
              className={`font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[18px] text-nowrap ${
                vm.p2StatusTone === 'ready' ? 'text-[#9cff84]' : 'text-white'
              }`}
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {vm.p2StatusText}
            </p>
          </StatusWrapper>
        )}
        <p
          className={`font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[28px] text-center w-full ${
            vm.p2IsReady ? 'text-[#888]' : 'text-[#d4d4d4]'
          }`}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {vm.p2Clock}
        </p>
      </div>
    </div>
  );
}