/**
 * TURN TIMINGS PANEL
 * 
 * Content-only page for turn timing breakdown
 * Static reference content - no CSV parsing or engine logic
 * Accepts onNavigate callback for tab switching
 */

import React from 'react';
import { BuildIcon } from '../ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../ui/primitives/icons/BattleIcon';
import { HeartIcon } from '../ui/primitives/icons/HeartIcon';
import { ChevronDown } from '../ui/primitives/icons/ChevronDown';
import { Dice } from '../ui/primitives/dice/Dice';

type RulesTab = 'core' | 'human' | 'xenite' | 'centaur' | 'ancient' | 'timings';

interface TurnTimingsPanelProps {
  onNavigate?: (tab: RulesTab) => void;
}

function PhaseHeader({ 
  title, 
  icon
}: { 
  title: string; 
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#555] h-[75.576px] relative shrink-0 w-full">
      <div className="content-stretch flex items-center px-[41.986px] py-[18.894px] relative size-full">
        <div className="content-stretch flex gap-[16.795px] items-center relative shrink-0">
          <p className="font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
            {title}
          </p>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TimingRow({ 
  title, 
  titleBold = false,
  description, 
  exampleShips = "",
  children,
  backgroundColor = "bg-black",
  showChevron = true,
  chevronTop,
  showHeart = false,
  leftPadding = "pl-[104.966px]",
  chevronLeft = "left-[56px]",
  verticalPadding = "py-[33.589px]"
}: { 
  title: React.ReactNode;
  titleBold?: boolean;
  description: React.ReactNode;
  exampleShips?: string;
  children?: React.ReactNode;
  backgroundColor?: string;
  showChevron?: boolean;
  chevronTop?: string;
  showHeart?: boolean;
  leftPadding?: string;
  chevronLeft?: string;
  verticalPadding?: string;
}) {
  return (
    <div className={`${backgroundColor} relative shrink-0 w-full`}>
      <div className={`content-stretch flex flex-col gap-[8.397px] items-start ${leftPadding} pr-[75.576px] ${verticalPadding} relative w-full`}>
        <p className={`font-['Roboto'] ${titleBold ? 'font-black' : 'font-semibold'} leading-[20.993px] min-w-full relative shrink-0 text-[18.894px] text-white w-[min-content]`} style={{ fontVariationSettings: "'wdth' 100" }}>
          {title}
        </p>
        <div className="font-['Roboto'] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[16.795px] text-white w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {description}
        </div>
        {exampleShips && (
          <p className="font-['Roboto'] font-normal leading-[23.093px] min-w-full relative shrink-0 text-[#888] text-[14.8px] w-[min-content]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {exampleShips}
          </p>
        )}
        {showChevron && (
          <div className={`absolute ${chevronLeft} size-[50.384px] ${chevronTop || 'top-[30px]'}`}>
            <ChevronDown className="-rotate-90" color="#555555" />
          </div>
        )}
        {showHeart && (
          <div className="absolute left-[34px] size-[50.384px] top-[18.67px]">
            <HeartIcon color="white" className="w-[50px] h-[50px]" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function TurnTimingsPanel({ onNavigate }: TurnTimingsPanelProps) {
  return (
    <div className="content-stretch flex flex-col gap-[48px] items-start relative shrink-0 w-full text-white">
      {/* Page Header */}
      <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
        <div className="content-stretch flex gap-[20px] items-center relative shrink-0">
          <p className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[36px] text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Turn Timings
          </p>
        </div>
        <p className="font-['Roboto'] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[215px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          A breakdown of the phases that can occur during a turn.
        </p>
      </div>

      {/* START OF TURN */}
      <p className="font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
        START OF TURN
      </p>

      {/* BUILD PHASE */}
      <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full border-[3px] border-[#555] border-solid">
        <PhaseHeader 
          title="Build Phase" 
          icon={<BuildIcon className="w-[33.589px] h-[33.589px]" color="#D5D5D5" />}
        />
        
        <TimingRow
          title={
            <>
              <span className="font-black" style={{ fontVariationSettings: "'wdth' 100" }}>Dice Roll </span>
              <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>& Dice Manipulation</span>
            </>
          }
          description={
            <p>Roll a six sided dice for all players. Dice Manipulation powers may change the result.</p>
          }
          exampleShips="Leviathan, Ark of Knowledge."
          showChevron={false}
        >
          <div className="absolute h-[50px] left-[31px] top-[33.42px] w-[52px]">
            <Dice value={6} className="w-[52px] h-[50px]" />
          </div>
        </TimingRow>

        <TimingRow
          title="Line Generation"
          description={
            <p>Players calculate available lines by adding the dice roll, any saved lines, and any bonus lines from ships powers.</p>
          }
          exampleShips="Orbital, Battlecruiser, 3rd Science Vessel, Oxite Face, Asterite Face, Ship of Vigor, Ark of Redemption, Ark of Power, Ark of Domination, Convert."
          backgroundColor="bg-[#212121]"
          chevronTop="top-[20px]"
        />

        <TimingRow
          title="Ships That Build"
          description={
            <p>Players may use their Ships That Build before the drawing phase. Ships made now can be used for upgrades, and are active this Battle Phase.</p>
          }
          exampleShips="Carrier, Bug Breeder, Zenith, Sacrificial Pool."
          chevronTop="top-[20px]"
        />

        <TimingRow
          title="Drawing"
          titleBold={true}
          description={
            <p>
              Players draw ships, and/or save lines. Drawing powers occur in this phase. Note that any 'Ships That Build' drawn <span className="italic">now</span> will not be active until next turn.
            </p>
          }
          exampleShips="Frigate, Dreadnought, Evolver, Zenith, Ship of Legacy."
          backgroundColor="bg-[#212121]"
          chevronTop="top-[20px]"
        />

        <TimingRow
          title="End of Build Phase"
          description={
            <p>Some special powers occur now, before the Battle Phase begins.</p>
          }
          exampleShips="Chronoswarm, Ark of Redemption."
          chevronTop="top-[20px]"
        />
      </div>

      {/* BATTLE PHASE */}
      <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full border-[3px] border-[#555] border-solid">
        <PhaseHeader 
          title="BATTLE PHASE" 
          icon={<BattleIcon className="w-[33.589px] h-[33.589px]" color="white" />}
        />
        
        <TimingRow
          title="First Strike"
          description={
            <p>Ship powers with First Strike occur. Any ships that are destroyed during this phase will not activate their Battle Phase powers. Any ships that are stolen during this phase will be active for their owner.</p>
          }
          exampleShips="Guardian, Ark of Domination."
          chevronTop="top-[20px]"
        />

        <TimingRow
          title={
            <>
              Charge Declaration <span className="text-[#d4d4d4]">/ Solar Powers</span>
            </>
          }
          description={
            <>
              <p className="mb-[8.397px]">Players may declare charge powers (max one per ship per turn) or hold the charges. Ancients may use solar powers if they have energy to do so. Players may declare multiple charges, or hold them in response to opponent declarations.</p>
              <p>
                If NO players declare charges now, then proceed to <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>End of Turn Resolution</span>.
              </p>
            </>
          }
          exampleShips="Interceptor, Antlion, Ship of Equality, Ship of Wisdom, Ship of Family, Solar Powers."
          backgroundColor="bg-[#212121]"
          chevronTop="top-[20px]"
        />

        {/* Charge Response / Solar Powers - Wrapper with left border */}
        <div className="content-stretch flex flex-col items-start relative shrink-0 w-full border-l-[21px] border-[#555] border-solid">
          <TimingRow
            title={
              <>
                Charge Response <span className="text-[#d4d4d4]">/ Solar Powers</span>
              </>
            }
            description={
              <>
                <p className="mb-[8.397px]">Players may declare charge powers in response to opponent's declarations or hold the charges. Ancients may use solar powers if they have energy to do so. Players may declare multiple charges, or hold them until a future turn.</p>
                <p className="mb-[8.397px]">
                  If a charge-based ship is destroyed, it's charge still occurs. <span className="italic text-[14.8px]" style={{ fontVariationSettings: "'wdth' 100" }}>See also Ship of Equality rules.</span>
                </p>
                <p className="mb-[8.397px]">If a ship with Automatic damage and healing is destroyed, it's power does NOT occur (except 'once only' powers).</p>
                <p>
                  All damage and healing is resolved in <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>End of Turn Resolution.</span>
                </p>
              </>
            }
            leftPadding="pl-[146.953px]"
            chevronLeft="left-[100px]"
            chevronTop="top-[24px]"
          />
        </div>

        {/* End of Turn Resolution - Outside the bordered wrapper */}
        <TimingRow
          title="End of Turn Resolution"
          titleBold={true}
          description={
            <p>
              Resolve all damage and healing effects simultaneously, then update health once. This includes damage and healing from all <span className="font-black" style={{ fontVariationSettings: "'wdth' 100" }}>Automatic</span> ship powers (including 'once-only'), and all damage and healing from Charges. Players cannot be above 35 health after resolution. If any player is 0 or below go to <span className="font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>Victory</span> (Core Rules).
            </p>
          }
          exampleShips="(All Automatic Ships)"
          backgroundColor="bg-[#212121]"
          showChevron={false}
          showHeart={true}
        />
      </div>

      {/* END OF TURN */}
      <p className="font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[20.993px] text-nowrap text-right uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
        END OF TURN
      </p>

      {/* Next: Core Rules Button */}
      <div className="content-stretch flex flex-col items-start relative shrink-0">
        <button 
          className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onNavigate?.('core')}
        >
          <p className="font-['Roboto'] font-bold leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Next: Core Rules
          </p>
        </button>
      </div>
    </div>
  );
}