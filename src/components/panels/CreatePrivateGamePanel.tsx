/**
 * CREATE PRIVATE GAME PANEL
 * 
 * Matches "Menu Screen - Multiplayer - Create Game" Figma design
 * Pure UI component with local state and callbacks
 */

import React, { useState } from 'react';
import { MenuButton } from '../ui/primitives/buttons/MenuButton';
import { RadioButton } from '../ui/primitives/controls/RadioButton';
import { Checkbox } from '../ui/primitives/controls/Checkbox';
import { ChevronDown } from '../ui/primitives/icons/ChevronDown';

interface CreatePrivateGameSettings {
  timed: boolean;
  minutes: number | null;
  incrementSeconds: number | null;
  variantKey: '1v1_standard';
}

interface CreatePrivateGamePanelProps {
  onCreatePrivateGame: (settings: CreatePrivateGameSettings) => Promise<void>;
  onBack?: () => void;
}

// TODO: Replace with selectable dropdowns when wiring backend
const AVAILABLE_MINUTES = [5, 10, 15, 30];
const AVAILABLE_INCREMENTS = [0, 5, 10, 15, 30];

export function CreatePrivateGamePanel({ 
  onCreatePrivateGame,
  onBack 
}: CreatePrivateGamePanelProps) {
  const [isTimed, setIsTimed] = useState(false); // Default: Not Timed
  const [minutes, setMinutes] = useState(10);
  const [incrementSeconds, setIncrementSeconds] = useState(15);
  const [variantKey] = useState<'1v1_standard'>('1v1_standard');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGame = async () => {
    setIsCreating(true);
    setError('');

    try {
      await onCreatePrivateGame({
        timed: isTimed,
        minutes: isTimed ? minutes : null,
        incrementSeconds: isTimed ? incrementSeconds : null,
        variantKey,
      });
    } catch (error: any) {
      setError(error.message || 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="content-stretch flex flex-col gap-[40px] items-start relative w-full">
      {/* Header */}
      <div className="content-stretch flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative shrink-0 w-full">
        <div className="content-stretch flex flex-col gap-[9px] items-start leading-[normal] relative shrink-0">
          <p className="font-['Roboto:Black',sans-serif] font-black relative shrink-0 text-[36px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Create Private Game
          </p>
          <p className="font-['Roboto:Regular',sans-serif] font-normal relative shrink-0 text-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Share the game URL with a friend.
          </p>
        </div>
        <MenuButton 
          variant="private" 
          onClick={handleCreateGame}
          disabled={isCreating}
          className="w-full md:w-auto md:min-w-[300px]"
        >
          {isCreating ? 'CREATING...' : 'CREATE PRIVATE GAME'}
        </MenuButton>
      </div>

      {/* Error Display */}
      {error && (
        <div className="w-full p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          {error}
        </div>
      )}

      {/* Divider */}
      <div className="bg-gradient-to-r from-[rgba(255,255,255,0)] h-px opacity-70 shrink-0 to-[rgba(255,255,255,0)] via-50% via-[#ffffff] w-full" />

      {/* Time Controls */}
      <div className="relative shrink-0 w-full">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex flex-col md:flex-row gap-[40px] md:gap-[72px] items-start md:items-center pl-0 md:pl-[50px] pr-0 py-0 relative w-full">
            {/* Timed/Not Timed */}
            <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0">
              {/* Not Timed */}
              <div 
                className="content-stretch flex gap-[8px] items-center relative shrink-0 cursor-pointer"
                onClick={() => setIsTimed(false)}
              >
                <RadioButton selected={!isTimed} />
                <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[26px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Not timed
                </p>
              </div>
              {/* Timed */}
              <div 
                className="content-stretch flex gap-[8px] items-center relative shrink-0 cursor-pointer"
                onClick={() => setIsTimed(true)}
              >
                <RadioButton selected={isTimed} />
                <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[26px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Timed
                </p>
              </div>
            </div>

            {/* Time Selection (only show when timed) */}
            {isTimed && (
              <div className="content-stretch flex flex-col md:flex-row gap-[32px] md:gap-[52px] items-start md:items-center relative shrink-0">
                {/* Minutes */}
                <div className="content-stretch flex flex-col gap-[12px] items-start justify-center relative shrink-0">
                  <div className="bg-black content-stretch flex items-center justify-between p-[10px] relative rounded-[10px] shrink-0 w-[180px]">
                    <div aria-hidden="true" className="absolute border-2 border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
                    <p className="font-['Roboto:Black',sans-serif] font-black leading-[36px] relative shrink-0 text-[36px] text-nowrap flex-1" style={{ fontVariationSettings: "'wdth' 100" }}>
                      <span>{minutes} </span>
                      <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
                        min
                      </span>
                    </p>
                    <ChevronDown />
                  </div>
                  <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[20px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Each player
                  </p>
                </div>

                {/* Increment */}
                <div className="content-stretch flex flex-col gap-[12px] items-start justify-center relative shrink-0">
                  <div className="bg-black content-stretch flex items-center justify-between p-[10px] relative rounded-[10px] shrink-0 w-[180px]">
                    <div aria-hidden="true" className="absolute border-2 border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]" />
                    <p className="font-['Roboto:Black',sans-serif] font-black leading-[36px] relative shrink-0 text-[36px] text-nowrap flex-1" style={{ fontVariationSettings: "'wdth' 100" }}>
                      <span>{incrementSeconds} </span>
                      <span className="font-['Roboto:Regular',sans-serif] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
                        sec
                      </span>
                    </p>
                    <ChevronDown />
                  </div>
                  <p className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[20px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Increment per turn
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1v1 Standard (Selected) */}
      <div className="bg-[rgba(0,0,0,0.5)] relative rounded-[14px] shrink-0 w-full">
        <div aria-hidden="true" className="absolute border-[6px] border-solid border-white inset-[-6px] pointer-events-none rounded-[20px]" />
        <div className="content-stretch flex flex-col items-start px-[37px] py-[34px] relative w-full">
          <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
            <RadioButton selected={true} color="white" className="size-[60px]" />
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[36px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              1v1 Standard
            </p>
          </div>
        </div>
      </div>

      {/* 1v1 Variant (Future - Disabled) */}
      <div className="bg-black opacity-30 relative rounded-[14px] shrink-0 w-full pointer-events-none">
        <div aria-hidden="true" className="absolute border-2 border-solid border-[#555] inset-[-2px] pointer-events-none rounded-[16px]" />
        <div className="content-stretch flex flex-col gap-[40px] items-start px-[40px] py-[35px] relative w-full">
          {/* Variant Heading */}
          <div className="content-stretch flex gap-[4px] items-center relative shrink-0">
            <RadioButton selected={false} color="white" className="size-[60px]" />
            <p className="font-['Roboto:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[36px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
              1v1 Variant
              <span className="font-['Roboto:Light',sans-serif] font-light" style={{ fontVariationSettings: "'wdth' 100" }}>
                {` (future)`}
              </span>
            </p>
          </div>

          {/* Variant Grid */}
          <div className="relative shrink-0 ml-auto">
            <div className="gap-[50px] grid grid-cols-1 md:grid-cols-2 grid-rows-[repeat(3,_minmax(0px,_1fr))] pb-[40px] pl-0 md:pl-[30px] pr-0 pt-0 relative w-full">
              {/* Quick Start */}
              <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0">
                <div className="content-stretch flex gap-[10px] items-center justify-start relative shrink-0 w-full">
                  <Checkbox checked={true} disabled />
                  <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px]">
                    Quick Start
                  </p>
                </div>
                <div className="content-stretch flex items-center pl-[40px] pr-0 py-0 relative shrink-0 w-full">
                  <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px]">
                    On the first turn, roll the dice three times and add, both players receive this many lines.
                  </p>
                </div>
              </div>

              {/* Accelerated Game */}
              <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0">
                <div className="content-stretch flex gap-[10px] items-center justify-start relative shrink-0 w-full">
                  <Checkbox checked={false} disabled />
                  <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px]">
                    Accelerated Game
                  </p>
                </div>
                <div className="content-stretch flex items-center pl-[40px] pr-0 py-0 relative shrink-0 w-full">
                  <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px]">
                    Roll two dice per turn. Any dice interactions occur on the second dice only.
                  </p>
                </div>
              </div>

              {/* No Destroy Powers */}
              <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0">
                <div className="content-stretch flex gap-[10px] items-center justify-start relative shrink-0 w-full">
                  <Checkbox checked={false} disabled />
                  <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px]">
                    No Destroy Powers
                  </p>
                </div>
                <div className="content-stretch flex items-center pl-[40px] pr-0 py-0 relative shrink-0 w-full">
                  <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px]">
                    <span className="font-['Inter:Italic',sans-serif] italic">Guardian</span>
                    {` and `}
                    <span className="font-['Inter:Italic',sans-serif] italic">Black Hole</span>
                    {` are banned, and `}
                    <span className="font-['Inter:Italic',sans-serif] italic">Ships of Equality</span>
                    {` are built with their charges used.`}
                  </p>
                </div>
              </div>

              {/* Less 1s */}
              <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0">
                <div className="content-stretch flex gap-[10px] items-center justify-start relative shrink-0 w-full">
                  <Checkbox checked={false} disabled />
                  <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px]">
                    Less 1s
                  </p>
                </div>
                <div className="content-stretch flex items-center pl-[40px] pr-0 py-0 relative shrink-0 w-full">
                  <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px]">
                    {`Reroll 1's. Until a 6 is rolled, then the next 1 is not rerolled.`}
                  </p>
                </div>
              </div>

              {/* Epic Battle */}
              <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0">
                <div className="content-stretch flex gap-[10px] items-center justify-start relative shrink-0 w-full">
                  <Checkbox checked={false} disabled />
                  <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px]">
                    Epic Battle
                  </p>
                </div>
                <div className="content-stretch flex items-center pl-[40px] pr-0 py-0 relative shrink-0 w-full">
                  <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px]">
                    Players start with 50 health, 70 max.
                  </p>
                </div>
              </div>

              {/* Antimatter Species */}
              <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0">
                <div className="content-stretch flex gap-[10px] items-center justify-start relative shrink-0 w-full">
                  <Checkbox checked={false} disabled />
                  <p className="basis-0 font-['Inter:Semi_Bold',sans-serif] font-semibold grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[18px]">
                    Antimatter Species
                  </p>
                </div>
                <div className="content-stretch flex items-center pl-[40px] pr-0 py-0 relative shrink-0 w-full">
                  <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[16px]">
                    One player draws lines equal to 7 minus the dice roll, resulting in asymmetrical line amounts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}