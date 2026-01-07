/**
 * CORE RULES PANEL
 * 
 * Content-only page for core game rules
 * Uses central ship graphics registry
 * Accepts onNavigate callback for tab switching
 */

import React from 'react';
import { FighterShip, TacticalCruiserShip } from '../../graphics/human/assets';
import { ShipOfEquality2Ship, ShipOfEquality1Ship } from '../../graphics/centaur/assets';
import { BuildIcon } from '../ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../ui/primitives/icons/BattleIcon';

type RulesTab = 'core' | 'human' | 'xenite' | 'centaur' | 'ancient' | 'timings';

interface CoreRulesPanelProps {
  onNavigate?: (tab: RulesTab) => void;
}

function HrGradient() {
  return (
    <div className="h-px relative shrink-0 w-full">
      <div className="absolute bg-gradient-to-r from-[rgba(255,255,255,0)] inset-0 opacity-70 to-[rgba(255,255,255,0)] via-50% via-[#ffffff]" />
    </div>
  );
}

function PhaseSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#212121] relative shrink-0 w-full">
      <div className="content-stretch flex gap-[30px] items-start pb-[30px] pl-[30px] pr-[40px] pt-[24px] relative w-full">
        {children}
      </div>
    </div>
  );
}

export function CoreRulesPanel({ onNavigate }: CoreRulesPanelProps) {
  return (
    <div className="content-stretch flex flex-col gap-[36px] items-start relative shrink-0 w-full text-white">
      {/* Page Title */}
      <p className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[36px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
        Core Rules
      </p>

      {/* Overview Section */}
      <div className="content-stretch flex flex-col gap-[36px] items-start relative shrink-0 w-full">
        <HrGradient />

        {/* Your Goal */}
        <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
          <p className="font-['Roboto'] font-bold leading-[24.365px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Your Goal
          </p>
          <div className="flex-1 font-['Roboto'] font-semibold leading-[26px] relative text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            <p className="mb-[9.75px]">Build your fleet up over the game to defeat your opponent in battle!</p>
            <p className="font-normal">
              Ships directly heal you and/or damage your opponent. Ships don't have health of their own, and damage is not targeted.
            </p>
          </div>
        </div>

        <HrGradient />

        {/* Setup */}
        <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
          <p className="font-['Roboto'] font-bold leading-[24.365px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Setup
          </p>
          <div className="flex-1 font-['Roboto'] leading-[26px] relative text-[18px]">
            <p className="mb-[9.75px]">
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Players each start with </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>25 health</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>, with a </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>maximum of 35</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>.</span>
            </p>
            <p className="font-semibold mb-[9.75px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Each player chooses a Species, and play begins.
            </p>
            <p className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
              Players may choose the same Species.
            </p>
          </div>
        </div>

        <HrGradient />

        {/* Turns */}
        <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
          <p className="font-['Roboto'] font-bold leading-[24.365px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Turns
          </p>
          <div className="flex-1 font-['Roboto'] leading-[26px] relative text-[18px]">
            <p className="mb-[9.75px]">
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Each turn has two phases: the </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Build</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> phase, then the </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Battle</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> phase. All players play the build phase together, then all players play the battle phase together.</span>
            </p>
            <p>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>See </span>
              <span 
                className="font-bold underline cursor-pointer hover:opacity-80" 
                style={{ fontVariationSettings: "'wdth' 100" }}
                onClick={() => onNavigate?.('timings')}
              >
                Turn Timings
              </span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> for full phase details.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0 w-full">
        {/* Build Phase */}
        <PhaseSection>
          <div className="h-[96px] w-[134px] flex items-center justify-center relative shrink-0">
            <BuildIcon className="scale-[4]" color="#D5D5D5" />
          </div>
          <div className="flex-1 content-stretch flex flex-col gap-[12px] items-start relative">
            <div className="content-stretch flex items-center relative shrink-0">
              <p className="font-['Roboto'] font-semibold leading-[24.365px] relative shrink-0 text-[#62fff6] text-[24.365px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                Build Phase
              </p>
            </div>

            {/* Build Phase Content */}
            <div className="font-['Roboto'] leading-[26px] min-w-full relative text-[18px]">
              <p className="font-semibold mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Roll a six-sided dice.
              </p>
              <p className="font-semibold mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                All players draw (or save) that many LINES this turn.
              </p>
              <p className="mb-[12.18px]">
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>LINES make Shapeships, which are defined shapes that have powers (see </span>
                <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Shapeships </span>
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>below).</span>
              </p>
              <p className="font-normal mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Players draw lines simultaneously, and drawing is hidden until the Battle Phase. You may save lines over multiple turns.
              </p>
              <p>
                <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Players may action their Shapeship POWERS that occur in the Build Phase. </span>
                <span className="font-normal italic" style={{ fontVariationSettings: "'wdth' 100" }}>
                  Dice Manipulation, Line Generation, Ships That Build, Drawing, End of Build Phase.
                </span>
              </p>
            </div>
          </div>
        </PhaseSection>

        {/* Battle Phase */}
        <PhaseSection>
          <div className="h-[96px] w-[134px] flex items-center justify-center relative shrink-0">
            <BattleIcon className="scale-[4]" color="white" />
          </div>
          <div className="flex-1 content-stretch flex flex-col gap-[15px] items-start relative">
            <div className="content-stretch flex items-center relative shrink-0">
              <p className="font-['Roboto'] font-semibold leading-[24.365px] relative shrink-0 text-[#62fff6] text-[24.365px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
                Battle Phase
              </p>
            </div>

            {/* Battle Phase Content */}
            <div className="font-['Roboto'] leading-[26px] min-w-full relative text-[18px]">
              <p className="font-semibold mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                Players ships are revealed to opponents.
              </p>
              <p className="mb-[12.18px]">
                <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Players Shapeship POWERS that occur in the Battle Phase are actioned</span>
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>. Players may declare charges (optional ship powers) and respond to charges. </span>
              </p>
              <p className="mb-[12.18px]">
                <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Each player's HEALTH will update.</span>
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> (if it has changed). </span>
              </p>
              <p>
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>If either player's health is </span>
                <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>0</span>
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> or less at the end of the turn the game is over (see </span>
                <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Victory </span>
                <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>below).</span>
              </p>
            </div>
          </div>
        </PhaseSection>
      </div>

      {/* Shapeships Section */}
      <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
        <div className="content-stretch flex flex-col gap-[23px] items-center relative shrink-0">
          <p className="font-['Roboto'] font-bold leading-[24.365px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Shapeships
          </p>
          
          {/* Example Ships Graphics */}
          <div className="content-stretch flex flex-col gap-[23px] items-center relative shrink-0 w-[116px]">
            {/* Fighter */}
            <div className="content-stretch flex flex-col gap-[2px] items-center relative shrink-0 w-[90.098px]">
              <div className="h-[77.97px] relative shrink-0 w-[90.098px] flex items-center justify-center">
                <FighterShip className="w-[90px] h-[78px]" />
              </div>
              <p className="font-['Inter'] font-medium leading-[24.365px] min-w-full text-[15.838px] text-center text-white tracking-[-0.1584px] w-[min-content]">
                Fighter
              </p>
            </div>

            {/* Ship of Equality - Full (2 charges) */}
            <div className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-full">
              <div className="h-[38.887px] relative shrink-0 w-[74.664px] flex items-center justify-center">
                <ShipOfEquality2Ship className="w-[87px] h-[45px]" />
              </div>
              <p className="font-['Inter'] font-medium leading-[21.929px] min-w-full text-[15.838px] text-center text-white tracking-[-0.1584px] w-[min-content]">
                Ship of Equality
              </p>
            </div>

            {/* Ship of Equality - 1 charge */}
            <div className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-full">
              <div className="h-[38.887px] relative shrink-0 w-[74.664px] flex items-center justify-center">
                <ShipOfEquality1Ship className="w-[87px] h-[45px]" />
              </div>
              <p className="font-['Inter'] font-medium leading-[21.929px] min-w-full text-[15.838px] text-center text-white tracking-[-0.1584px] w-[min-content]">
                1 (of 2) charges
                <br />
                used
              </p>
            </div>
          </div>
        </div>

        {/* Shapeships Description */}
        <div className="flex-1 font-['Roboto'] leading-[26px] relative text-[18px]">
          <p className="mb-[12.18px]">
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Shapeships are defined shapes that have </span>
            <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>powers</span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>. </span>
            <span className="font-normal italic" style={{ fontVariationSettings: "'wdth' 100" }}>For example: 3 lines can make a Human shapeship called a Fighter. It's power is to deal 1 damage every turn.</span>
          </p>
          <p className="mb-[12.18px]">
            <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Basic Ships</span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> are the building blocks of your fleet. These can be combined into </span>
            <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Upgraded Ships</span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> (see below).</span>
          </p>
          <p className="font-normal mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Ships cannot be split up into separate lines once completed.
          </p>
          <p className="mb-[12.18px]">
            <span className="font-normal italic" style={{ fontVariationSettings: "'wdth' 100" }}>Charges: </span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Some ships have charges. These are limited-use powers that can be used once per turn, or held for later.</span>
          </p>
          <p>
            <span className="italic" style={{ fontVariationSettings: "'wdth' 100" }}>Once Only: </span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Some Automatic powers occur just once when a ship is completed. Any healing or damage from these powers is resolved at the end of the turn. (Even if the ship is destroyed during Battle Phase).</span>
          </p>
        </div>
      </div>

      <HrGradient />

      {/* Upgraded Ships Section */}
      <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0">
          <p className="font-['Roboto'] font-bold leading-[24.365px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Upgraded Ships
          </p>
          
          {/* Tactical Cruiser Graphic */}
          <div className="content-stretch flex flex-col gap-[12px] items-center relative shrink-0 w-[132.511px]">
            <div className="h-[115.048px] relative shrink-0 w-full flex items-center justify-center">
              <TacticalCruiserShip className="w-[129px] h-[115px]" />
            </div>
            <div className="font-['Roboto'] font-medium leading-[21.929px] relative shrink-0 text-[15.838px] text-center tracking-[-0.1584px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
              <p className="mb-0">
                1 Fighter +<br />2 Defenders +<br />3 joining lines =
              </p>
              <p>a Tactical Cruiser</p>
            </div>
          </div>
        </div>

        {/* Upgraded Ships Description */}
        <div className="flex-1 font-['Roboto'] leading-[26px] relative text-[18px]">
          <p className="mb-[12.18px]">
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>You can </span>
            <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>combine</span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> Basic Ships into Upgraded Ships. This is done by drawing 'joining lines'.</span>
          </p>
          <p className="font-normal mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            The upgraded ship's power is active the turn it is complete (and the basic ship's powers are no longer active).
          </p>
          <p className="font-normal mb-[12.18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Upgrades are permanent. Once complete, upgraded ships only have THEIR powers. They cannot be used as separate ships (or reverted to separate ships).
          </p>
          <p>
            <span className="italic" style={{ fontVariationSettings: "'wdth' 100" }}>Combining Ships with Charges: </span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>All charges must be used before combining.</span>
          </p>
        </div>
      </div>

      <HrGradient />

      {/* Victory Section */}
      <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
        <p className="font-['Roboto'] font-bold leading-[24.75px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Victory
        </p>
        
        <div className="flex-1 content-stretch flex flex-col gap-[24px] items-start relative">
          {/* Decisive Victory */}
          <div className="relative shrink-0 w-full">
            <p className="font-['Roboto'] font-semibold leading-[26px] mb-[7.43px] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Decisive Victory
            </p>
            <p className="font-['Roboto'] leading-[26px] text-[18px]">
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>If at the end of a turn, after all powers are resolved, one player's health is </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>0</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> or less and the other player's health is </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>1</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> or more, that player wins the game!</span>
            </p>
          </div>

          {/* Narrow Victory */}
          <div className="relative shrink-0 w-full">
            <p className="font-['Roboto'] font-semibold leading-[26px] mb-[7.43px] text-[18.563px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Narrow Victory
            </p>
            <p className="font-['Roboto'] leading-[26px] text-[18.563px]">
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>If at the end of a turn, after all powers are resolved, both players health is </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>0</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> or less, the player who is closer to </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>0</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> wins. e.g. if Player A has </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>-3</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> and Player B has </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>-5</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>, Player A wins. </span>
            </p>
          </div>

          {/* Draw */}
          <div className="relative shrink-0 w-full">
            <p className="font-['Roboto'] font-semibold leading-[26px] mb-[7.43px] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Draw
            </p>
            <p className="font-['Roboto'] leading-[26px] text-[18px]">
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>If at the end of a turn, after all powers are resolved, both players health is </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>0</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}> or less </span>
              <span className="font-normal italic" style={{ fontVariationSettings: "'wdth' 100" }}>and the same</span>
              <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>, the game is drawn. </span>
            </p>
          </div>

          {/* Draw by mutual prosperity */}
          <div className="leading-[26px] relative shrink-0 text-[18px] w-full">
            <p className="font-['Roboto'] font-semibold mb-[7.43px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              Draw by mutual prosperity
            </p>
            <p className="font-['Roboto'] font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
              If both players have 35 (maximum) health for three turns in a row, they may agree to a draw and live in peace.
            </p>
          </div>
        </div>
      </div>

      <HrGradient />

      {/* Destroying Rules */}
      <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
        <p className="font-['Roboto'] font-bold leading-[24.75px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Destroying Rules
        </p>
        
        <div className="flex-1 font-['Roboto'] leading-[26px] relative text-[18px]">
          <p className="mb-[12.375px]">
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Ships with the </span>
            <span className="font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>Destroy </span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>power can only destroy Basic Ships. They CANNOT destroy Upgraded Ships.</span>
          </p>
          <p className="mb-[12.375px]">
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>Depending on when a ship is destroyed, it's Battle Phase power may not occur (see </span>
            <span className="font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>Turn Timing Breakdown</span>
            <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>).</span>
          </p>
          <p className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
            Once a ship is destroyed it is out of the game, and does not count for X powers.
          </p>
        </div>
      </div>

      <HrGradient />

      {/* Saving Lines */}
      <div className="content-stretch flex gap-[30px] items-start relative shrink-0 w-full">
        <p className="font-['Roboto'] font-bold leading-[24.75px] relative shrink-0 text-[22px] w-[164px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          Saving Lines
        </p>
        
        <p className="flex-1 font-['Roboto'] font-normal leading-[26px] relative text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          You may save a maximum of 12 lines (including joining lines).
        </p>
      </div>

      {/* Next: Human Species Button */}
      <div className="content-stretch flex items-start pl-[194px] relative shrink-0">
        <button 
          className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onNavigate?.('human')}
        >
          <p className="font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Next: Human Species
          </p>
        </button>
      </div>
    </div>
  );
}