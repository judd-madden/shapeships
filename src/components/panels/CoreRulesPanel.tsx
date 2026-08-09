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
import { ShipPowerTagBadgeRow } from '../../game/display/shared/ShipPowerTagBadgeRow';
import { ChargesIcon } from '../ui/primitives/icons/ChargesIcon';
import { ChevronDown } from '../ui/primitives/icons/ChevronDown';
import { DiceRollIcon } from '../ui/primitives/icons/DiceRollIcon';
import { DrawingIcon } from '../ui/primitives/icons/DrawingIcon';
import { FirstStrikeIcon } from '../ui/primitives/icons/FirstStrikeIcon';
import { HeartIcon } from '../ui/primitives/icons/HeartIcon';

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

type StaticTurnPhaseIconKind = 'dice-roll' | 'drawing' | 'first-strike' | 'charges' | 'heart';

interface StaticTurnPhase {
  label: string;
  greyedOut: boolean;
  icon?: StaticTurnPhaseIconKind;
}

const STATIC_TURN_PHASES: readonly StaticTurnPhase[] = [
  { label: 'Dice Roll', greyedOut: false, icon: 'dice-roll' },
  { label: 'Line Generation', greyedOut: true },
  { label: 'Drawing', greyedOut: false, icon: 'drawing' },
  { label: 'Reveal', greyedOut: true },
  { label: 'First Strike', greyedOut: false, icon: 'first-strike' },
  { label: 'Charges', greyedOut: false, icon: 'charges' },
  { label: 'Turn Resolution', greyedOut: true, icon: 'heart' },
];

function StaticTurnPhaseIcon({ icon }: { icon: StaticTurnPhaseIconKind }) {
  const props = {
    className: `size-[24px] xl:size-[32px] shrink-0 ${icon === 'heart' ? 'opacity-50' : ''}`,
    color: 'var(--shapeships-white)',
  };

  if (icon === 'dice-roll') return <DiceRollIcon {...props} />;
  if (icon === 'drawing') return <DrawingIcon {...props} />;
  if (icon === 'first-strike') return <FirstStrikeIcon {...props} />;
  if (icon === 'charges') return <ChargesIcon {...props} />;
  return <HeartIcon {...props} />;
}

function StaticTurnPhaseStrip() {
  return (
    <div className="mt-[16px] w-full max-w-full">
      <div className="mb-[6px] flex items-end justify-between">
        <span className="bg-white font-bold leading-none text-black px-[16px] py-[12px] text-[14px]">
          START OF TURN
        </span>
        <span className="invisible sm:visible bg-white font-bold leading-none text-black px-[16px] py-[12px] text-[14px]">
          END OF TURN
        </span>
      </div>
      <div className="flex flex-col gap-[4px] sm:gap-0 sm:flex-row w-full items-center justify-center sm:justify-around overflow-hidden bg-[var(--shapeships-grey-90)] px-[32px] py-[32px]">
        {STATIC_TURN_PHASES.map((phase, index) => (
          <React.Fragment key={phase.label}>
            <div className="flex min-w-0 items-center gap-[8px] text-left sm:w-auto sm:flex-col sm:justify-center sm:text-center">
              {phase.icon ? <StaticTurnPhaseIcon icon={phase.icon} /> : null}
              <span className={`text-[16px] sm:text-[15px] lg:text-[17px] font-bold leading-[1] ${phase.greyedOut ? 'opacity-40' : ''}`}>
                {phase.label}
              </span>
            </div>
            {index < STATIC_TURN_PHASES.length - 1 ? (
              <ChevronDown
                className="size-[24px]! xl:size-[30px]! shrink-0 sm:-rotate-90"
                color="var(--shapeships-grey-50)"
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>      
        <span className="inline-block mt-[8px] sm:mt-0 sm:invisible visible bg-white font-bold leading-none text-black px-[16px] py-[12px] text-[14px]">
          END OF TURN
        </span>
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
          <div className="relative flex-1 text-[16.5px] font-bold leading-[24px] sm:text-[20px] sm:leading-[32px]">
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
          <div className="relative flex-1 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
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

        {/* Gameplay */}
        <RuleRow
          aside={(
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Gameplay
            </p>
          )}
        >
          <div className="relative flex-1 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
            <ul className="list-disc space-y-[16px] pl-[18px] marker:text-white">
              <li>At the start of each turn, roll the dice. All players gain <span className="font-bold">LINES</span> equal to the dice roll. Plus any bonuses.</li>
              <li><span className="font-bold">LINES</span> make Shapeships, which are defined shapes that have powers.</li>
              <li>Players draw simultaneously, then reveal simultaneously.</li>
              <li>You must draw completed ships. You may save lines over multiple turns.</li>
              <li>During each phase, players may action their Shapeship <span className="font-bold">POWERS</span> if they have any available.</li>
              <li>At the end of each turn, player <span className="font-bold">HEALTH</span> will update.</li>
              <li>If either player's health is 0 or less at the end of the turn the game is over.</li>
            </ul>
          </div>
        </RuleRow>
        <HrGradient />

        {/* Turn Phases */}
        <RuleRow
          aside={(
            <p className="font-bold leading-[18.25px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.365px]">
              Turn Phases
            </p>
          )}
        >
          <div className="relative flex-1 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
            <p className="mb-[9.75px]">All players play each phase together. Greyed-out phases never require player choice.</p>
            <p>
              See{' '}
              <span className="cursor-pointer font-bold underline hover:opacity-80" onClick={() => onNavigate?.('timings')}>
                Turn Phases
              </span>{' '}
              for a full breakdown.
            </p>
          </div>
        </RuleRow>
      </div>

      <StaticTurnPhaseStrip />

      <HrGradient />

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
                <p className="font-medium leading-[18.25px] min-w-full text-[11.875px] text-center text-white tracking-[-0.1584px] w-[min-content] sm:text-[15.838px] sm:leading-[24.365px]">
                  Fighter
                </p>
              </div>

              {/* Ship of Equality - Full (2 charges) */}
              <div className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-full">
                <div className="h-[38.887px] relative shrink-0 w-[74.664px] flex items-center justify-center">
                  <ShipOfEquality2Ship className="w-[87px] h-[45px]" />
                </div>
                <p className="font-medium leading-[16.45px] min-w-full text-[11.875px] text-center text-white tracking-[-0.1584px] w-[min-content] sm:text-[15.838px] sm:leading-[21.929px]">
                  Ship of Equality
                </p>
              </div>

              {/* Ship of Equality - 1 charge */}
              <div className="content-stretch flex flex-col gap-[5px] items-center relative shrink-0 w-full">
                <div className="h-[38.887px] relative shrink-0 w-[74.664px] flex items-center justify-center">
                  <ShipOfEquality1Ship className="w-[87px] h-[45px]" />
                </div>
                <p className="font-medium leading-[16.45px] min-w-full text-[11.875px] text-center text-white tracking-[-0.1584px] w-[min-content] sm:text-[15.838px] sm:leading-[21.929px]">
                  1 (of 2) charges
                  <br />
                  used
                </p>
              </div>
            </div>
          </div>
        )}
      >
        <div className="relative flex-1 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
          <p className="mb-[12.18px]">
            <span className="font-normal">Shapeships are defined shapes that have </span>
            <span className="font-bold">powers</span>
            <span className="font-normal">.</span>
          </p>
          <p className="font-normal italic mb-[12.18px]">
            For example: 3 lines can make a Human shapeship called a Fighter. Its power is to deal 1 damage every turn.
          </p>
          <p className="mb-[12.18px]">
            <span className="font-bold">Basic Ships</span>
            <span className="font-normal"> are the building blocks of your fleet. These can be combined into </span>
            <span className="font-bold">Upgraded Ships</span>
            <span className="font-normal"> (see right).</span>
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
            <span className="font-normal">Some Automatic powers occur just once when a ship is completed. Any healing or damage from these powers is resolved at the end of the turn. (Even if the ship is destroyed later that turn).</span>
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
        <div className="relative flex-1 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
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

      {/* Saving Lines */}
      <RuleRow
        aside={(
          <p className="font-bold leading-[18.55px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.75px]">
            Saving Lines
          </p>
        )}
      >
        <p className="relative flex-1 text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
          You may save a maximum of 12 lines (including joining lines).
        </p>
      </RuleRow>

      <HrGradient />

      {/* Special Powers */}
      <RuleRow
        aside={(
          <p className="font-bold leading-[18.55px] relative shrink-0 text-[16.5px] sm:text-[22px] sm:leading-[24.75px]">
            Special Powers
          </p>
        )}
      >
        <div className="flex flex-1 flex-col gap-[20px] text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
          <div>
            <ShipPowerTagBadgeRow labels={['MAKES SHIPS']} />
            <p className="mt-[9.75px]">Some powers make ships. The listed phase shows when those ships are made. Ships made before or during Drawing can be used for upgrades during that Drawing phase.</p>
          </div>
          <div>
            <ShipPowerTagBadgeRow labels={['TARGETS SHIPS']} />
            <p className="mt-[9.75px]">Some powers target other ships in your fleet or your opponent's fleet.</p>
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
        <div className="relative flex-1  text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
          <p className="mb-[12.375px]">
            <span className="font-normal">Ships with the </span>
            <span className="font-bold">Destroy </span>
            <span className="font-normal">power can only destroy Basic Ships. They CANNOT destroy Upgraded Ships.</span>
          </p>
          <p className="mb-[12.375px]">
            If a Charge power has already been declared, its effect still occurs if the source ship is destroyed. If a ship with an Automatic power is destroyed, its power does NOT occur (except Once Only powers, which DO occur).
          </p>
          <p className="font-normal">
            Once a ship is destroyed it is out of the game, and does not count for X powers. You may erase or scribble over it.
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
          <div className="relative shrink-0 w-full">
            <p className="font-bold mb-[7.43px]  text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">Decisive Victory</p>
            <p className=" text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
              If at the end of a turn, after all powers are resolved, one player's health is 0 or less and the other player's health is 1 or more, that player wins the game!
            </p>
          </div>
          <div className="relative shrink-0 w-full">
            <p className="font-bold mb-[7.43px]  text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">Narrow Victory</p>
            <p className=" text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
              If at the end of a turn, after all powers are resolved, both players health is 0 or less, the player who is closer to 0 wins. e.g. If Player A has -3 and Player B has -5, Player A wins.
            </p>
          </div>
          <div className="relative shrink-0 w-full">
            <p className="font-bold mb-[7.43px]  text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">Draw</p>
            <p className=" text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
              If at the end of a turn, after all powers are resolved, both players health is 0 or less <span className="italic">and the same</span>, the game is drawn.
            </p>
          </div>
          <div className="relative shrink-0 w-full  text-[16.5px] leading-[24px] sm:text-[20px] sm:leading-[32px]">
            <p className="font-bold mb-[7.43px]">Draw by mutual prosperity</p>
            <p className="font-normal">If both players have 35 (maximum) health for three turns in a row, they may agree to a draw and live in peace.</p>
          </div>
        </div>
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
