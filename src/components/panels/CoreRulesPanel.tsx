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
import { DrawingIcon } from '../ui/primitives/icons/DrawingIcon';
import { ChargesIcon } from '../ui/primitives/icons/ChargesIcon';

type RulesTab = 'core' | 'human' | 'xenite' | 'centaur' | 'ancient' | 'timings';

interface CoreRulesPanelProps {
  onNavigate?: (tab: RulesTab) => void;
}

function HrGradient() {
  return (
    <div className="h-px relative shrink-0 w-full">
      <div className="absolute bg-gradient-to-r from-[rgba(255,255,255,0)] inset-0 opacity-70 to-[rgba(255,255,255,0)] via-50% via-[var(--shapeships-white)]" />
    </div>
  );
}

function PhaseSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--shapeships-grey-90)] relative shrink-0 w-full">
      <div className="content-stretch relative flex w-full flex-col items-start gap-[20px] px-[20px] pb-[24px] pt-[20px] md:flex-row md:gap-[30px] md:px-[30px] md:pb-[30px] md:pr-[40px] md:pt-[24px]">
        {children}
      </div>
    </div>
  );
}

function RuleRow({
  aside,
  children,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="content-stretch relative flex w-full shrink-0 flex-col items-start gap-[16px] md:flex-row md:gap-[30px]">
      <div className="w-full md:w-[164px] md:shrink-0">{aside}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function CoreRulesPanel({ onNavigate }: CoreRulesPanelProps) {
  return (
    <div className="content-stretch flex flex-col gap-[24px] sm:gap-[36px] items-start relative shrink-0 w-full">
      {/* Page Title */}
      <p className="font-black leading-[normal] relative shrink-0 text-[24px] sm:text-[36px]">
        Core Rules
      </p>

      {/* Overview Section */}
      <div className="content-stretch flex flex-col gap-[24px] sm:gap-[36px] items-start relative shrink-0 w-full">
        <HrGradient />

        {/* Your Goal */}
        <RuleRow
          aside={(
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Your Goal
            </p>
          )}
        >
          <div className="relative flex-1 text-[16.5px] font-bold leading-[24px] sm:text-[22px] sm:leading-[32px]">
            <p className="mb-[9.75px]">Build your fleet up over the game to defeat your opponent in battle!</p>
            <p className="font-normal">
              Shapeships isn't about movement or targeting. Ships don't move, don't have health, and (mostly) don't interact with each other directly. When you build a ship, its power becomes a permanent part of your fleet — dealing damage, healing you, or changing how future turns work (extra lines, altered dice, free ships, and more). Fleets grow stronger each turn until one player is defeated.
            </p>
          </div>
        </RuleRow>

        <HrGradient />

        {/* Setup */}
        <RuleRow
          aside={(
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Setup
            </p>
          )}
        >
          <div className="relative flex-1 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
            <p className="mb-[9.75px]">
              <span className="font-normal">Players each start with </span>
              <span className="font-bold">25 health</span>
              <span className="font-normal">, with a </span>
              <span className="font-bold">maximum of 35</span>
              <span className="font-normal">.</span>
            </p>
            <p className="font-normal mb-[9.75px]">
              Players each start with <span className="font-bold">3 saved lines.</span>
            </p>
            <p className="font-bold mb-[9.75px]">
              Each player chooses a Species, and play begins.
            </p>
            <p className="font-normal">
              Players may choose the same Species.
            </p>
          </div>
        </RuleRow>

        <HrGradient />

        {/* Turns */}
        <RuleRow
          aside={(
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Turns
            </p>
          )}
        >
          <div className="relative flex-1 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
            <p className="mb-[9.75px]">
              <span className="font-normal">Each turn has two phases: the </span>
              <span className="font-bold">Build</span>
              <span className="font-normal"> phase, then the </span>
              <span className="font-bold">Battle</span>
              <span className="font-normal"> phase. All players play the build phase together, then all players play the battle phase together.</span>
            </p>
            <p>
              <span className="font-normal">See </span>
              <span
                className="font-bold underline cursor-pointer hover:opacity-80"
                onClick={() => onNavigate?.('timings')}
              >
                Turn Timings
              </span>
              <span className="font-normal"> for full phase details.</span>
            </p>
          </div>
        </RuleRow>
      </div>

      {/* Phases */}
      <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0 w-full">
        {/* Build Phase */}
        <PhaseSection>
          <div className="relative flex h-[96px] w-full shrink-0 items-center justify-center md:w-[134px]">
            <DrawingIcon className="scale-[4]" color="#D5D5D5" />
          </div>
          <div className="content-stretch relative flex min-w-0 flex-1 flex-col items-start gap-[12px]">
            <div className="content-stretch flex items-center relative shrink-0">
              <p className="font-bold leading-[18.25px] relative shrink-0 text-[var(--shapeships-pastel-blue)] text-[18.25px] sm:text-[24.365px] sm:leading-[24.365px]">
                Build Phase
              </p>
            </div>

            {/* Build Phase Content */}
            <div className="relative w-full min-w-0 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
              <p className="font-bold mb-[12.18px]">
                Roll a six-sided dice.
              </p>
              <p className="font-bold mb-[12.18px]">
                All players gain that many LINES this turn (plus any bonuses).
              </p>
              <p className="mb-[12.18px]">
                <span className="font-normal">LINES make Shapeships, which are defined shapes that have powers (see </span>
                <span className="font-bold">Shapeships </span>
                <span className="font-normal">below).</span>
              </p>
              <p className="font-normal mb-[12.18px]">
                Players draw lines simultaneously, and drawing is hidden until the Battle Phase. You may save lines over multiple turns.
              </p>
              <p>
                <span className="font-bold">Players may action their Shapeship POWERS that occur in the Build Phase. </span>
                <span className="font-normal italic">
                  Dice Manipulation, Line Generation, Ships That Build, Drawing, End of Build Phase.
                </span>
              </p>
            </div>
          </div>
        </PhaseSection>

        {/* Battle Phase */}
        <PhaseSection>
          <div className="relative flex h-[96px] w-full shrink-0 items-center justify-center md:w-[134px]">
            <ChargesIcon className="scale-[4]" color="white" />
          </div>
          <div className="content-stretch relative flex min-w-0 flex-1 flex-col items-start gap-[15px]">
            <div className="content-stretch flex items-center relative shrink-0">
              <p className="font-bold leading-[18.25px] relative shrink-0 text-[var(--shapeships-pastel-blue)] text-[18.25px] sm:text-[24.365px] sm:leading-[24.365px]">
                Battle Phase
              </p>
            </div>

            {/* Battle Phase Content */}
            <div className="relative w-full min-w-0 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
              <p className="font-bold mb-[12.18px]">
                Players' ships are revealed.
              </p>
              <p className="mb-[12.18px]">
                <span className="font-bold">Players Shapeship POWERS that occur in the Battle Phase are actioned</span>
                <span className="font-normal">. Players may declare charges (optional ship powers). </span>
              </p>
              <p className="mb-[12.18px]">
                <span className="font-bold">Each player's HEALTH will update.</span>
                <span className="font-normal"> (if it has changed). </span>
              </p>
              <p>
                <span className="font-normal">If either player's health is </span>
                <span className="font-bold">0</span>
                <span className="font-normal"> or less at the end of the turn the game is over (see </span>
                <span className="font-bold">Victory </span>
                <span className="font-normal">below).</span>
              </p>
            </div>
          </div>
        </PhaseSection>
      </div>

      {/* Shapeships Section */}
      <RuleRow
        aside={(
          <div className="content-stretch relative flex flex-col items-center gap-[23px] md:items-start">
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Shapeships
            </p>

            {/* Example Ships Graphics */}
            <div className="content-stretch relative flex shrink-0 flex-col items-center gap-[23px] w-[116px]">
              {/* Fighter */}
              <div className="content-stretch flex flex-col gap-[2px] items-center relative shrink-0 w-[90.098px]">
                <div className="h-[77.97px] relative shrink-0 w-[90.098px] flex items-center justify-center">
                  <FighterShip className="w-[90px] h-[78px]" />
                </div>
                <p className="font-['Roboto'] font-medium leading-[18.25px] min-w-full text-[11.875px] text-center text-white tracking-[-0.1584px] w-[min-content] sm:text-[15.838px] sm:leading-[24.365px]">
                  Fighter
                </p>
              </div>

              {/* Ship of Equality - Full (2 charges) */}
              <div className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-full">
                <div className="h-[38.887px] relative shrink-0 w-[74.664px] flex items-center justify-center">
                  <ShipOfEquality2Ship className="w-[87px] h-[45px]" />
                </div>
                <p className="font-['Roboto'] font-medium leading-[16.45px] min-w-full text-[11.875px] text-center text-white tracking-[-0.1584px] w-[min-content] sm:text-[15.838px] sm:leading-[21.929px]">
                  Ship of Equality
                </p>
              </div>

              {/* Ship of Equality - 1 charge */}
              <div className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-full">
                <div className="h-[38.887px] relative shrink-0 w-[74.664px] flex items-center justify-center">
                  <ShipOfEquality1Ship className="w-[87px] h-[45px]" />
                </div>
                <p className="font-['Roboto'] font-medium leading-[16.45px] min-w-full text-[11.875px] text-center text-white tracking-[-0.1584px] w-[min-content] sm:text-[15.838px] sm:leading-[21.929px]">
                  1 (of 2) charges
                  <br />
                  used
                </p>
              </div>
            </div>
          </div>
        )}
      >
        <div className="relative flex-1 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
          <p className="mb-[12.18px]">
            <span className="font-normal">Shapeships are defined shapes that have </span>
            <span className="font-bold">powers</span>
            <span className="font-normal">. </span>
            <span className="font-normal italic">For example: 3 lines can make a Human shapeship called a Fighter. Its power is to deal 1 damage every turn.</span>
          </p>
          <p className="mb-[12.18px]">
            <span className="font-bold">Basic Ships</span>
            <span className="font-normal"> are the building blocks of your fleet. These can be combined into </span>
            <span className="font-bold">Upgraded Ships</span>
            <span className="font-normal"> (see below).</span>
          </p>
          <p className="font-normal mb-[12.18px]">
            Ships cannot be split up into separate lines once completed.
          </p>
          <p className="mb-[12.18px]">
            <span className="font-normal italic">Charges: </span>
            <span className="font-normal">Some ships have charges. These are limited-use powers that can be used once per turn, or held for later.</span>
          </p>
          <p>
            <span className="italic">Once Only: </span>
            <span className="font-normal">Some Automatic powers occur just once when a ship is completed. Any healing or damage from these powers is resolved at the end of the turn. (Even if the ship is destroyed during Battle Phase).</span>
          </p>
        </div>
      </RuleRow>

      <HrGradient />

      {/* Upgraded Ships Section */}
      <RuleRow
        aside={(
          <div className="content-stretch relative flex flex-col items-center gap-[20px] md:items-start">
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Upgraded Ships
            </p>

            {/* Tactical Cruiser Graphic */}
            <div className="content-stretch relative flex shrink-0 flex-col items-center gap-[12px] w-[132.511px]">
              <div className="h-[115.048px] relative shrink-0 w-full flex items-center justify-center">
                <TacticalCruiserShip className="w-[129px] h-[115px]" />
              </div>
              <div className="font-medium leading-[16.45px] relative shrink-0 text-[11.875px] text-center tracking-[-0.1584px] w-full sm:text-[15.838px] sm:leading-[21.929px]">
                <p className="mb-0">
                  1 Fighter +<br />2 Defenders +<br />3 joining lines =
                </p>
                <p>a Tactical Cruiser</p>
              </div>
            </div>
          </div>
        )}
      >
        <div className="relative flex-1 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
          <p className="mb-[12.18px]">
            <span className="font-normal">You can </span>
            <span className="font-bold">combine</span>
            <span className="font-normal"> Basic Ships into Upgraded Ships. This is done by drawing 'joining lines'.</span>
          </p>
          <p className="font-normal mb-[12.18px]">
            The upgraded ship's power is active the turn it is complete (and the basic ship's powers are no longer active).
          </p>
          <p className="font-normal mb-[12.18px]">
            Upgrades are permanent. Once complete, upgraded ships only have THEIR powers. They cannot be used as separate ships (or reverted to separate ships).
          </p>
          <p>
            <span className="italic">Combining Ships with Charges: </span>
            <span className="font-normal">All charges must be used before combining.</span>
          </p>
        </div>
      </RuleRow>

      <HrGradient />

      {/* Victory Section */}
      <RuleRow
        aside={(
          <p className="font-bold leading-[18.55px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.75px]">
            Victory
          </p>
        )}
      >
        <div className="content-stretch relative flex flex-1 flex-col items-start gap-[24px]">
          {/* Decisive Victory */}
          <div className="relative shrink-0 w-full">
            <p className="font-bold leading-[20px] mb-[7.43px] text-[13.5px] sm:text-[18px] sm:leading-[26px]">
              Decisive Victory
            </p>
            <p className="leading-[20px] text-[13.5px] sm:text-[18px] sm:leading-[26px]">
              <span className="font-normal">If at the end of a turn, after all powers are resolved, one player's health is </span>
              <span className="font-bold">0</span>
              <span className="font-normal"> or less and the other player's health is </span>
              <span className="font-bold">1</span>
              <span className="font-normal"> or more, that player wins the game!</span>
            </p>
          </div>

          {/* Narrow Victory */}
          <div className="relative shrink-0 w-full">
            <p className="font-bold leading-[20px] mb-[7.43px] text-[13.922px] sm:text-[18.563px] sm:leading-[26px]">
              Narrow Victory
            </p>
            <p className="leading-[20px] text-[13.922px] sm:text-[18.563px] sm:leading-[26px]">
              <span className="font-normal">If at the end of a turn, after all powers are resolved, both players health is </span>
              <span className="font-bold">0</span>
              <span className="font-normal"> or less, the player who is closer to </span>
              <span className="font-bold">0</span>
              <span className="font-normal"> wins. e.g. if Player A has </span>
              <span className="font-bold">-3</span>
              <span className="font-normal"> and Player B has </span>
              <span className="font-bold">-5</span>
              <span className="font-normal">, Player A wins. </span>
            </p>
          </div>

          {/* Draw */}
          <div className="relative shrink-0 w-full">
            <p className="font-bold leading-[20px] mb-[7.43px] text-[13.5px] sm:text-[18px] sm:leading-[26px]">
              Draw
            </p>
            <p className="leading-[20px] text-[13.5px] sm:text-[18px] sm:leading-[26px]">
              <span className="font-normal">If at the end of a turn, after all powers are resolved, both players health is </span>
              <span className="font-bold">0</span>
              <span className="font-normal"> or less </span>
              <span className="font-normal italic">and the same</span>
              <span className="font-normal">, the game is drawn. </span>
            </p>
          </div>

          {/* Draw by mutual prosperity */}
          <div className="leading-[20px] relative shrink-0 text-[13.5px] w-full sm:text-[18px] sm:leading-[26px]">
            <p className="font-bold mb-[7.43px]">
              Draw by mutual prosperity
            </p>
            <p className="font-normal">
              If both players have 35 (maximum) health for three turns in a row, they may agree to a draw and live in peace.
            </p>
          </div>
        </div>
      </RuleRow>

      <HrGradient />

      {/* Destroying Rules */}
      <RuleRow
        aside={(
          <p className="font-bold leading-[18.55px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.75px]">
            Destroying Rules
          </p>
        )}
      >
        <div className="relative flex-1 text-[13.5px] leading-[20px] sm:text-[18px] sm:leading-[26px]">
          <p className="mb-[12.375px]">
            <span className="font-normal">Ships with the </span>
            <span className="font-bold">Destroy </span>
            <span className="font-normal">power can only destroy Basic Ships. They CANNOT destroy Upgraded Ships.</span>
          </p>
          <p className="mb-[12.375px]">
            <span className="font-normal">Depending on when a ship is destroyed, its Battle Phase power may not occur (see </span>
            <span className="font-bold">Turn Timing Breakdown</span>
            <span className="font-normal">).</span>
          </p>
          <p className="font-normal">
            Once a ship is destroyed it is out of the game, and does not count for X powers.
          </p>
        </div>
      </RuleRow>

      <HrGradient />

      {/* Saving Lines */}
      <RuleRow
        aside={(
          <p className="font-bold leading-[18.55px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.75px]">
            Saving Lines
          </p>
        )}
      >
        <p className="relative flex-1 text-[13.5px] font-normal leading-[20px] sm:text-[18px] sm:leading-[26px]">
          You may save a maximum of 12 lines (including joining lines).
        </p>
      </RuleRow>

      {/* Next: Human Species Button */}
      <div className="content-stretch relative flex items-start pl-0 shrink-0 md:pl-[194px]">
        <button
          className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onNavigate?.('human')}
        >
          <p className="font-bold leading-[normal] relative shrink-0 text-[13.5px] text-black text-nowrap sm:text-[18px]">
            Next: Human Species
          </p>
        </button>
      </div>
    </div>
  );
}
