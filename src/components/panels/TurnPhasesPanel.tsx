/**
 * TURN PHASES PANEL
 *
 * Static, presentation-only reference for the phases in a turn.
 */

import React, { useState } from 'react';
import {
  ChargesIcon,
  Checkbox,
  DiceRollIcon,
  DownArrowIcon,
  DrawingIcon,
  FirstStrikeIcon,
  HeartIcon,
} from '../ui/primitives';

type Species = 'Human' | 'Xenite' | 'Centaur' | 'Ancient';
type PhaseId =
  | 'dice-roll'
  | 'line-generation'
  | 'drawing'
  | 'reveal'
  | 'first-strike'
  | 'charges'
  | 'turn-resolution';

interface PhaseDefinition {
  id: PhaseId;
  greyed?: boolean;
  ships: Record<Species, string[]>;
  body: React.ReactNode[];
  rightBody?: React.ReactNode[];
}

const SPECIES: Species[] = ['Human', 'Xenite', 'Centaur', 'Ancient'];

const SPECIES_TEXT_CLASSES: Record<Species, string> = {
  Human: 'text-[var(--shapeships-pastel-blue)]',
  Xenite: 'text-[var(--shapeships-pastel-green)]',
  Centaur: 'text-[var(--shapeships-pastel-red)]',
  Ancient: 'text-[var(--shapeships-pastel-purple)]',
};

// Shared by the Medium/Large species headers and every phase row.
const SPECIES_COLUMN_CLASSES: Record<Species, string> = {
  Human: 'w-[99px]',
  Xenite: 'w-[96px]',
  Centaur: 'w-[130px]',
  Ancient: 'w-[78px]',
};

const COMPACT_SPECIES_COLUMN_CLASSES: Record<Species, string> = {
  Human: 'w-1/2 @min-[480px]:w-[20%]',
  Xenite: 'w-1/2 @min-[480px]:w-[22%]',
  Centaur: 'w-1/2 @min-[480px]:w-[38%]',
  Ancient: 'w-1/2 @min-[480px]:w-[20%]',
};

const PHASES: PhaseDefinition[] = [
  {
    id: 'dice-roll',
    ships: {
      Human: ['Leviathan'],
      Xenite: ['Chronoswarm'],
      Centaur: ['Ark of Knowledge'],
      Ancient: ['Cube'],
    },
    body: [
      <>Roll a six-sided die for all players. Some powers may change the result.</>,
    ],
  },
  {
    id: 'line-generation',
    greyed: true,
    ships: {
      Human: ['Orbital', 'Battlecruiser', '3rd Science Vessel'],
      Xenite: ['Oxite Face', 'Asterite Face'],
      Centaur: ['Ship of Vigor', 'Ark of Redemption', 'Ark of Power', 'Ark of Domination'],
      Ancient: ['Convert'],
    },
    body: [
      <>Calculate available lines by adding the dice roll, any saved lines, and any bonus lines from ship powers.</>,
    ],
  },
  {
    id: 'drawing',
    ships: {
      Human: ['Carrier', 'Frigate'],
      Xenite: ['Bug Breeder', 'Zenith', 'Queen', 'Evolver'],
      Centaur: ['Ship of Legacy'],
      Ancient: ['Quantum Mystic'],
    },
    body: [
      <>Players draw ships and/or save lines.</>,
      <>Drawing powers tagged with <span className="font-bold">MAKES SHIPS</span> occur at the start of this phase - but not on the turn they are built.</>,
    ],
  },
  {
    id: 'reveal',
    greyed: true,
    ships: {
      Human: ['Dreadnought'],
      Xenite: [],
      Centaur: ['Ark of Redemption'],
      Ancient: [],
    },
    body: [<>Some special powers occur now, as fleets are revealed.</>],
  },
  {
    id: 'first-strike',
    ships: {
      Human: ['Guardian'],
      Xenite: ['Sacrificial Pool'],
      Centaur: ['Ark of Domination'],
      Ancient: ['Spiral'],
    },
    body: [
      <>Ship powers with First Strike occur.</>,
      <>Any ships destroyed during this phase will not activate their Charges or Automatic powers, except Once Only powers.</>,
      <>Any ships that are stolen during this phase will be active for their owner this turn.</>,
    ],
  },
  {
    id: 'charges',
    ships: {
      Human: ['Interceptor'],
      Xenite: ['Antlion'],
      Centaur: ['Ship of Equality', 'Ship of Wisdom', 'Ship of Family'],
      Ancient: ['All Solar Powers'],
    },
    body: [
      <>Players may declare charge powers (max one per ship per turn) or hold the Charges.</>,
      <>Holding a Charge means that it cannot be used this turn.</>,
      <>Players may declare multiple Charges. Ancients may use Solar Powers if they have energy available.</>,
    ],
  },
  {
    id: 'turn-resolution',
    greyed: true,
    ships: { Human: [], Xenite: [], Centaur: [], Ancient: [] },
    body: [
      <>Resolve all damage and healing effects simultaneously, then update health once.</>,
      <>This includes damage and healing from all <span className="font-bold">Automatic ship powers</span> (including ‘once-only’), and all damage and healing from First Strike, Charges and Solar Powers.</>,
    ],
    rightBody: [
      <>Players cannot be above maximum health (normally 35) after resolution.</>,
      <>If any player is 0 or below go to <span className="font-bold">Victory</span> (Core Rules).</>,
    ],
  },
];

function PhaseIcon({ id }: { id: PhaseId }) {
  const className = 'size-full!';

  if (id === 'dice-roll') return <DiceRollIcon className={className} color="white" />;
  if (id === 'drawing') return <DrawingIcon className={className} color="white" />;
  if (id === 'first-strike') return <FirstStrikeIcon className={className} color="white" />;
  if (id === 'charges') return <ChargesIcon className={className} color="white" />;
  if (id === 'turn-resolution') {
    return <HeartIcon className={`${className} opacity-50`} color="white" />;
  }
  return null;
}

function PhaseHeading({ phase, large = false }: { phase: PhaseDefinition; large?: boolean }) {
  const icon = <PhaseIcon id={phase.id} />;
  const iconless = phase.id === 'line-generation' || phase.id === 'reveal';
  const titleClass = phase.greyed ? 'text-[var(--shapeships-grey-50)]' : 'text-white';

  return (
    <div className="flex min-w-0 items-start gap-[10px]">
      {iconless ? (large ? <span aria-hidden="true" className="size-[26px] shrink-0" /> : null) : (
        <span className="flex size-[26px] shrink-0 items-center justify-center">{icon}</span>
      )}
      <h2 className={`min-w-0 text-[20px] font-bold leading-[20px] ${titleClass}`}>
        {phase.id === 'dice-roll' && 'Dice Roll'}
        {phase.id === 'line-generation' && 'Line Generation'}
        {phase.id === 'drawing' && 'Drawing'}
        {phase.id === 'reveal' && 'Reveal'}
        {phase.id === 'first-strike' && 'First Strike'}
        {phase.id === 'charges' && (
          <>
            <span className="block text-white leading-[30px]">Charges</span>
            <span className="block text-[var(--shapeships-grey-50)]">Solar Powers</span>
          </>
        )}
        {phase.id === 'turn-resolution' && 'Turn Resolution'}
      </h2>
    </div>
  );
}

function BodyCopy({ paragraphs }: { paragraphs: React.ReactNode[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-[7px] text-[14px] font-normal leading-[18px] text-white @min-[480px]:gap-[10px] @min-[480px]:text-[16px] @min-[480px]:leading-[20px]">
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </div>
  );
}

function SpeciesShipList({ species, ships }: { species: Species; ships: string[] }) {
  return (
    <div className={`flex min-w-0 flex-col gap-[4px] text-[11px] font-medium leading-[11px] @min-[480px]:gap-[7px] @min-[480px]:text-[13px] @min-[480px]:leading-[16px] ${SPECIES_TEXT_CLASSES[species]}`}>
      {ships.map((ship) => <p key={ship}>{ship}</p>)}
    </div>
  );
}

function AlignedSpeciesColumns({ ships }: { ships: Record<Species, string[]> }) {
  return (
    <>
      {SPECIES.map((species) => (
        <div key={species} className={`shrink-0 px-[8px] py-[24px] ${SPECIES_COLUMN_CLASSES[species]}`}>
          <SpeciesShipList species={species} ships={ships[species]} />
        </div>
      ))}
    </>
  );
}

function CompactShips({ ships }: { ships: Record<Species, string[]> }) {
  return (
    <div className="flex w-full flex-wrap pt-[18px] @min-[480px]:pt-[22px]">
      {SPECIES.map((species) => (
        <div key={species} className={`shrink-0 pr-[10px] pb-[16px] last:pr-0 @min-[480px]:pb-0 ${COMPACT_SPECIES_COLUMN_CLASSES[species]}`}>
          <SpeciesShipList species={species} ships={ships[species]} />
        </div>
      ))}
    </div>
  );
}

function PhaseRow({ phase, showShips }: { phase: PhaseDefinition; showShips: boolean }) {
  const background = phase.greyed ? 'bg-[var(--shapeships-grey-90)]' : 'bg-black';
  const allBody = phase.rightBody ? [...phase.body, ...phase.rightBody] : phase.body;

  return (
    <div className={`${background} border-b border-[var(--shapeships-grey-70)] last:border-b-0`}>
      {/* Extra Small / Small */}
      <div className="flex flex-col px-[16px] py-[20px] @min-[480px]:px-[20px] @min-[480px]:py-[24px] @min-[720px]:hidden">
        <div className="flex flex-col gap-[7px]">
          <PhaseHeading phase={phase} />
          <BodyCopy paragraphs={allBody} />
        </div>
        {showShips && phase.id !== 'turn-resolution' ? <CompactShips ships={phase.ships} /> : null}
      </div>

      {/* Medium */}
      <div className="hidden min-h-[150px] items-stretch @min-[720px]:flex @min-[940px]:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-[7px] px-[20px] py-[24px]">
          <PhaseHeading phase={phase} />
          <BodyCopy paragraphs={allBody} />
        </div>
        {phase.id !== 'turn-resolution' ? <AlignedSpeciesColumns ships={phase.ships} /> : null}
      </div>

      {/* Large */}
      <div className="hidden min-h-[150px] items-stretch @min-[940px]:flex">
        <div className="w-[200px] shrink-0 px-[20px] py-[24px]">
          <PhaseHeading phase={phase} large />
        </div>
        <div className="flex min-w-0 flex-1 py-[24px] pr-[20px]">
          <BodyCopy paragraphs={phase.body} />
        </div>
        {phase.id === 'turn-resolution' ? (
          <div className="w-[410px] shrink-0 px-[8px] py-[24px]">
            <BodyCopy paragraphs={phase.rightBody ?? []} />
          </div>
        ) : (
          <AlignedSpeciesColumns ships={phase.ships} />
        )}
      </div>
    </div>
  );
}

function TurnMarker({ end = false }: { end?: boolean }) {
  return (
    <div className="inline-flex items-center gap-[8px] my-[16px] bg-white px-[10px] py-[7px] text-[12px] font-bold leading-none text-black uppercase @min-[480px]:text-[16px]">
      {!end && <DownArrowIcon color="black" />}
      {end ? 'End of Turn' : 'Start of Turn'}
    </div>
  );
}

function SpeciesHeaders() {
  return (
    <>
      {SPECIES.map((species) => (
        <div key={species} className={`shrink-0 px-[8px] pb-[8px] text-[13px] font-bold leading-[16px] uppercase ${SPECIES_TEXT_CLASSES[species]} ${SPECIES_COLUMN_CLASSES[species]}`}>
          {species}
        </div>
      ))}
    </>
  );
}

export function TurnPhasesPanel() {
  const [showShips, setShowShips] = useState(false);

  return (
    <div className="flex w-full shrink-0 flex-col items-start gap-[24px] @min-[480px]:gap-[48px]">
      <div className="flex w-full flex-col items-start justify-between gap-[16px] @min-[720px]:flex-row @min-[720px]:items-end">
        <h1 className="text-[24px] font-black leading-normal @min-[480px]:text-[36px]">Turn Phases</h1>
        <p className="w-full max-w-[390px] text-[12px] font-normal leading-[16.5px] @min-[480px]:text-[16px] @min-[480px]:leading-[22px] @min-[720px]:text-right">
          <span className="block">Greyed-out phases never require player choice.</span>
          <span className="block">When you’re playing online, they are run automatically.</span>
        </p>
      </div>

      <div className="flex w-full flex-col items-start">
        <div className="flex w-full items-center justify-between">
          <div className="@min-[940px]:w-[200px]">
            <TurnMarker />
          </div>
          <div className="hidden min-w-0 flex-1 @min-[720px]:block" />
          <div className="hidden items-end @min-[720px]:flex">
            <SpeciesHeaders />
          </div>
          <div className="@min-[720px]:hidden">
            <Checkbox
              checked={showShips}
              onChange={setShowShips}
              label="Show Ships"
              labelClassName="text-[14px] font-normal leading-[18px] text-white @min-[480px]:text-[16px] @min-[480px]:leading-[20px]"
            />
          </div>
        </div>

        <div className="w-full border-2 border-solid border-[var(--shapeships-grey-70)]">
          {PHASES.map((phase) => <PhaseRow key={phase.id} phase={phase} showShips={showShips} />)}
        </div>

        <TurnMarker end />
      </div>
    </div>
  );
}
