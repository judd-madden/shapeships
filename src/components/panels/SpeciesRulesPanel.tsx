/**
 * SPECIES RULES PANEL
 *
 * CSV-driven species ship reference
 * Static reference content - renders ship data from ShipDefinitions
 * Accepts species and onNavigate callback
 */

import React from 'react';
import { SHIP_DEFINITIONS } from '../../game/data/ShipDefinitionsUI';
import type { ShipDefinitionUI } from '../../game/types/ShipTypes.ui';
import {
  getShipPhaseLabel,
  getShipPowerPresentation,
} from '../../game/data/ShipPowerPresentation';
import { resolveShipGraphic } from '../../game/display/graphics/resolveShipGraphic';
import { ShipPowerRow } from '../../game/display/shared/ShipPowerRow';
import { ShipPowerTagBadgeRow } from '../../game/display/shared/ShipPowerTagBadgeRow';
import { getShipPowerTagLabels } from '../../game/data/ShipPowerTags';
import {
  ANCIENT_SIPHON_HIGH_BAND_INCREMENT,
  ANCIENT_SIPHON_RULES_TABLE_ROWS,
} from '../../game/data/ancientSiphonRules';

type RulesTab = 'core' | 'human' | 'xenite' | 'centaur' | 'ancient' | 'timings';
type SpeciesName = 'Human' | 'Xenite' | 'Centaur' | 'Ancient';
type EnergyCostTextClass =
  | 'text-shapeships-red'
  | 'text-shapeships-green'
  | 'text-shapeships-cyan'
  | 'text-shapeships-white';

interface EnergyCostRow {
  label: string;
  textClass: EnergyCostTextClass;
}

interface SpeciesRulesPanelProps {
  species: SpeciesName;
  onNavigate?: (tab: RulesTab) => void;
}

const SOLAR_POWER_NAME_TEXT_CLASSES: Record<string, EnergyCostTextClass> = {

};

// Get energy cost rows (Ancient Solar Powers only)
// Reads from ship.energyCost field (canonical JSON data)
function getEnergyCostRows(ship: ShipDefinitionUI): EnergyCostRow[] {
  if (ship.species !== 'Ancient' || ship.shipType !== 'Solar Power') {
    return [];
  }

  if (!ship.energyCost) {
    return [];
  }

  const rows: EnergyCostRow[] = [];
  const cost = ship.energyCost;

  // Red energy
  if (cost.red > 0) {
    rows.push({
      label: `${cost.red} red energy`,
      textClass: 'text-shapeships-red',
    });
  }

  // Green energy
  if (cost.green > 0) {
    rows.push({
      label: `${cost.green} green energy`,
      textClass: 'text-shapeships-green',
    });
  }

  // Blue energy (either X blue or numeric blue)
  if (cost.xBlue) {
    rows.push({
      label: 'X blue energy',
      textClass: 'text-shapeships-cyan',
    });
  } else if (cost.blue > 0) {
    rows.push({
      label: `${cost.blue} blue energy`,
      textClass: 'text-shapeships-cyan',
    });
  }

  return rows;
}

function getSolarPowerNameTextClass(ship: ShipDefinitionUI): string {
  if (ship.species !== 'Ancient' || ship.shipType !== 'Solar Power') {
    return 'text-white';
  }

  return SOLAR_POWER_NAME_TEXT_CLASSES[ship.name] || 'text-white';
}

function SiphonRulesTable() {
  return (
    <div className="relative mt-[10px] w-full shrink-0 overflow-x-auto pb-[20px]">
      <div className="flex w-max items-start gap-[16px] pl-0 sm:pl-[20px] lg:pl-[35px]">
        <div className="flex shrink-0 flex-col items-end text-[14px] font-medium leading-[1] text-white mt-[8px]">
          <p className="text-right text-[14px] font-medium leading-[1.1] ">
            Energy spent
            <br />
            of each colour
          </p>
          <div className="mt-[8px] flex flex-col items-end gap-[8px]">
            <p>Healing</p>
            <p>Damage</p>
          </div>
        </div>

        {ANCIENT_SIPHON_RULES_TABLE_ROWS.map(({ spend, effect }) => (
          <div key={spend} className="flex shrink-0 flex-col items-center pt-[15px] font-bold leading-[1.1]">
            <p className="text-white text-[16px] ">{spend}</p>
            <div className="mt-[12px] flex flex-col items-center gap-[6px]">
              <p className="text-[16px] text-shapeships-pastel-green">{effect}</p>
              <p className="text-[16px] text-shapeships-pastel-red">{effect}</p>
            </div>
          </div>
        ))}

        <div className="flex shrink-0 flex-col items-center pt-[15px] text-[16px] font-bold leading-[1.1]">
          <p className="text-white">+</p>
          <div className="mt-[12px] flex flex-col items-center gap-[6px]">
            <p className="text-[16px] text-shapeships-pastel-green">
              +{ANCIENT_SIPHON_HIGH_BAND_INCREMENT}
            </p>
            <p className="text-[16px] text-shapeships-pastel-red">
              +{ANCIENT_SIPHON_HIGH_BAND_INCREMENT}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <>
      <div className="bg-[var(--shapeships-grey-70)] relative shrink-0 w-full">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch relative flex size-full flex-col items-start justify-between gap-[16px] px-[20px] py-[16px] sm:px-[32px] sm:py-[19px] md:flex-row md:items-center">
            <p className="font-bold leading-[normal] relative shrink-0 text-[15px] text-white uppercase sm:text-[22px]">
              {title}
            </p>
          </div>
        </div>
      </div>
      {note && (
        <div className="bg-[var(--shapeships-grey-90)] relative flex min-h-[52px] shrink-0 w-full items-center px-[20px] py-[12px] sm:px-[32px]">
          <p className="font-normal italic leading-[15px] text-[12px] text-white sm:text-[16px] sm:leading-[20px]">
            {note}
          </p>
        </div>
      )}
    </>
  );
}

function ShipRow({
  ship,
  isAlternate,
  evolvedShips,
}: {
  ship: ShipDefinitionUI;
  isAlternate: boolean;
  evolvedShips?: ShipDefinitionUI[];
}) {
  // Robustly select a default graphic for display (default context = full charges)
  const defaultGraphic = resolveShipGraphic(ship, { context: 'default' });
  const ShipGraphic = defaultGraphic?.component;

  // Calculate cost display
  const totalCost = ship.totalLineCost;
  const joiningCost = ship.joiningLineCost;
  const isUpgradedShip = ship.shipType === 'Upgraded';
  const energyCostRows = getEnergyCostRows(ship);
  const solarPowerNameTextClass = getSolarPowerNameTextClass(ship);
  const powerTagLabels = getShipPowerTagLabels(ship.powers);

  return (
    <div className={`relative shrink-0 w-full ${isAlternate ? 'bg-[var(--shapeships-grey-90)]' : ''}`}>
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch relative grid w-full grid-cols-[100px_minmax(0,1fr)] items-start gap-[0px] pl-[0px] pr-[16px] py-[16px] sm:gap-[20px] sm:px-[24px] lg:flex lg:flex-row lg:gap-[20px] xl:gap-[12px] xl:py-[30px] xl:pr-[30px]">
          {/* Ship Graphic */}
          <div className="content-stretch relative flex w-[100px] max-w-[120px] shrink-0 items-start justify-center overflow-hidden lg:min-h-[60px] lg:w-[190px] lg:max-w-none flex-col lg:overflow-visible xl:w-[215px]">
            <div className="relative flex  w-[100px] items-center justify-center overflow-hidden lg:h-auto lg:w-full lg:overflow-visible">
              {ShipGraphic && <ShipGraphic className="h-auto w-auto max-h-[200px] max-w-[200px] origin-center scale-[0.6] lg:max-h-none lg:max-w-full lg:scale-100" />}
            </div>
          </div>

          <div className="flex min-w-0 max-w-full flex-1 flex-col gap-[8px] lg:flex-row xl:gap-[12px]">
            {/* Ship Info */}
            <div className="content-stretch relative flex min-w-0 max-w-full gap-[8px] md:gap-[16px] items-start lg:w-[210px] lg:shrink-0">
              {/* Cost display */}
              {totalCost !== null && (
                <p className="font-black leading-[normal] relative shrink-0 text-[19.27px] sm:text-right text-white sm:w-[30px] sm:text-[25.691px]">
                  {totalCost}
                </p>
              )}

              {/* Name, Energy Cost (Ancient Solar Powers), Joining Cost (if upgraded), and Subphase */}
              <div className="basis-0 content-stretch relative flex min-h-px min-w-0 grow shrink-0 flex-col items-start gap-[2px]">
                <p className={`font-bold leading-[19.27px] relative shrink-0 text-[15px] sm:text-[20px] sm:leading-[25.691px] ${solarPowerNameTextClass} w-full`}>
                  {ship.name}
                </p>
                {energyCostRows.length > 0 && (
                  <div className="pb-[6px] relative shrink-0">
                    {energyCostRows.map((row) => (
                      <p key={row.label} className={`font-normal leading-[13.5px] ${row.textClass} text-[10.5px] sm:text-[14px] sm:leading-[18px]`}>
                        {row.label}
                      </p>
                    ))}
                  </div>
                )}
                {isUpgradedShip && joiningCost !== null && joiningCost !== undefined && (
                  <p className="font-normal leading-[18px] pb-[6px] relative shrink-0 text-[var(--shapeships-grey-20)] text-[13.5px] sm:text-[18px] sm:leading-[24px]">
                    (+{joiningCost})
                  </p>
                )}
                <div className="flex w-full flex-col items-start gap-[4px]">
                  <p className="font-normal leading-[11.5px] relative shrink-0 text-[var(--shapeships-grey-20)] text-[10.5px] w-full sm:text-[13px] sm:leading-[14.13px]">
                    {getShipPhaseLabel(ship.powers)}
                  </p>
                  <ShipPowerTagBadgeRow labels={powerTagLabels} />
                </div>
              </div>
            </div>

            {/* Powers */}
            <div className="content-stretch relative flex min-w-0 flex-1 flex-col items-start">
              {ship.powers.map((power, index) => {
                const presentation = getShipPowerPresentation(power);

                return (
                  <ShipPowerRow
                    key={index}
                    iconKind={presentation.iconKind}
                    fallbackIconClassName="sm:pt-[9px]"
                  >
                    {/* Power text (preserve CSV wording exactly) */}
                    <p className="basis-0 font-normal grow leading-[20px] min-h-px min-w-0 relative shrink-0 text-[13.5px] pb-[10px] text-white whitespace-pre-wrap sm:text-[18px] sm:leading-[26px]">
                      {presentation.text}
                    </p>
                  </ShipPowerRow>
                );
              })}

              {ship.id === 'SSIP' && <SiphonRulesTable />}

              {/* Evolved Ships Display (CSV-driven: shipType === 'Basic - Evolved') */}
              {evolvedShips && evolvedShips.length > 0 && (
                <div className="relative shrink-0 w-full mt-[10px]">
                  <div className="flex flex-col gap-[16px] pb-[20px]">
                    {/* Evolved ships grid */}
                    <div className="flex flex-wrap gap-[20px] items-start pl-0 sm:pl-[20px] lg:gap-[32px] lg:pl-[35px]">
                      {evolvedShips.map((evolvedShip) => {
                        const evolvedGraphic = resolveShipGraphic(evolvedShip, { context: 'default' });
                        const EvolvedShipGraphic = evolvedGraphic?.component;
                        const evolvedSubphase = getShipPhaseLabel(evolvedShip.powers);

                        return (
                          <div key={evolvedShip.id} className="flex min-w-0 max-w-full gap-[12px] items-start sm:min-w-[220px]">
                            {/* Evolved ship graphic */}
                            <div className="relative shrink-0 w-[28px] h-[28px] sm:w-[48px] sm:h-[48px] flex items-center justify-center">
                              {EvolvedShipGraphic && <EvolvedShipGraphic className="max-w-full h-auto" />}
                            </div>

                            {/* Evolved ship info */}
                            <div className="flex min-w-0 flex-col gap-[2px]">
                              <p className="font-bold leading-[15px] text-[12px] text-white sm:text-[16px] sm:leading-[20px]">
                                {evolvedShip.name}
                              </p>
                              <p className="font-normal leading-[14px] text-[10.5px] text-[var(--shapeships-grey-20)] sm:text-[12px] sm:leading-[16px]">
                                {evolvedSubphase}
                              </p>
                              {evolvedShip.powers.map((power, idx) => {
                                const presentation = getShipPowerPresentation(power);
                                return (
                                  <ShipPowerRow
                                    key={idx}
                                    iconKind={presentation.iconKind}
                                    className="mt-[4px]"
                                    fallbackIconClassName="pt-[2px]! sm:pt-[4px]! w-[8px]!"
                                  >
                                    <p className="min-w-0 font-normal leading-[13.5px] text-[10.5px] text-white sm:text-[14px] sm:leading-[18px]">
                                      {presentation.text}
                                    </p>
                                  </ShipPowerRow>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Extra rules / notes */}
              {ship.extraRules && (
                <div className="relative shrink-0 w-full">
                  <div className="flex flex-row items-center size-full">
                    <div className="content-stretch relative flex w-full items-center  pr-0 py-0 pl-[32px]">
                      <p className="basis-0 font-normal grow italic leading-[15px] min-h-px min-w-0 relative shrink-0 text-[12px] text-white whitespace-pre-wrap sm:text-[16px] sm:leading-[20px]">
                        {ship.extraRules}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Navigation mapping
const SPECIES_NAVIGATION: Record<SpeciesName, { next: RulesTab; label: string }> = {
  Human: { next: 'xenite', label: 'Xenite' },
  Xenite: { next: 'centaur', label: 'Centaur' },
  Centaur: { next: 'ancient', label: 'Ancient' },
  Ancient: { next: 'timings', label: 'Turn Timings' },
};

export function SpeciesRulesPanel({ species, onNavigate }: SpeciesRulesPanelProps) {
  // Filter ships by species
  const speciesShips = SHIP_DEFINITIONS.filter((ship) => ship.species === species);

  // Categorize ships
  // Separate 'Basic - Evolved' ships (Oxite, Asterite) from regular basic ships
  const basicShipsOnly = speciesShips.filter((ship) => ship.shipType === 'Basic');
  const evolvedShips = speciesShips.filter((ship) => ship.shipType === 'Basic - Evolved');
  const upgradedShips = speciesShips.filter((ship) => ship.shipType === 'Upgraded');
  const solarPowers = speciesShips.filter((ship) => ship.shipType === 'Solar Power');

  // Navigation
  const navigation = SPECIES_NAVIGATION[species];

  // Species-specific metadata (hardcoded)
  const speciesMetadata: Record<string, { origin: string; tagline: string }> = {
    Human: {
      origin: 'Sol',
      tagline: 'Metal. Explosions. Expansion.\nOnward and upward.',
    },
    Xenite: {
      origin: 'Xenon',
      tagline: 'Swarm. Queen. Hive.\nAlways growing.',
    },
    Centaur: {
      origin: 'Alpha Centauri',
      tagline: 'Power. Timing. Domination.\nCull the weak.',
    },
    Ancient: {
      origin: 'Sol',
      tagline: 'Energy. Solar Powers.\nEver present.',
    },
  };

  // Helper functions to get species origin and tagline
  function getSpeciesOrigin(currentSpecies: SpeciesName): string {
    return speciesMetadata[currentSpecies]?.origin || '';
  }

  function getSpeciesTagline(currentSpecies: SpeciesName): string {
    return speciesMetadata[currentSpecies]?.tagline || '';
  }

  // Species display name mapping
  const speciesDisplayName: Record<SpeciesName, string> = {
    Human: 'Human',
    Xenite: 'Xenite',
    Centaur: 'Centaur',
    Ancient: 'Ancient',
  };

  const speciesData = {
    displayName: speciesDisplayName[species] || species,
  };

  return (
    <div className="content-stretch flex flex-col gap-[24px] sm:gap-[48px] items-start relative shrink-0 w-full">
      {/* Page Header */}
      <div className="content-stretch relative flex size-full flex-col items-start justify-between gap-[16px] text-white md:flex-row md:items-end" data-name="Rules Header">
        <div className="content-stretch relative flex flex-wrap items-center gap-x-[20px] gap-y-[8px]" data-name="Species">
          <p className="font-black leading-[normal] relative shrink-0 text-[24px] sm:text-[36px]">
            {speciesData.displayName}
          </p>
          <p className="font-bold leading-[normal] not-italic relative shrink-0 text-[13.5px] sm:text-[20px]">
            <span className="font-normal text-white">{`from `}</span>
            <span className="font-bold">
              {getSpeciesOrigin(species)}
            </span>
          </p>
        </div>
        <p className="font-normal leading-[16.5px] relative shrink-0 text-[12px] w-full max-w-[255px] whitespace-pre-line sm:text-[16px] sm:leading-[22px] md:text-right">
          {getSpeciesTagline(species)}
        </p>
      </div>

      {species === 'Ancient' && (
        <p className="font-normal leading-[20px] relative w-full text-[13.5px] text-white sm:text-[18px] sm:leading-[26px]">
          <span className="font-bold">Energy</span> is a resource unique to the Ancient species. Each of the three Cores generate a different colour energy, this is used to cast Solar Powers. The Ancients use Solar Powers instead of Upgraded Ships. You may cast multiple Solar Powers in a turn, if you have the energy to do so. Note: Energy cannot be saved over multiple turns.
        </p>
      )}

      {/* BASIC SHIPS */}
      <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="absolute border-[var(--shapeships-grey-70)] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
        <SectionHeader title="Basic Ships" />
        {basicShipsOnly.map((ship, index) => {
          // CSV-driven: Pass evolved ships to Evolver row (ship ID 'EVO')
          const shouldShowEvolvedShips = ship.id === 'EVO' && evolvedShips.length > 0;
          return (
            <ShipRow
              key={ship.id}
              ship={ship}
              isAlternate={index % 2 === 1}
              evolvedShips={shouldShowEvolvedShips ? evolvedShips : undefined}
            />
          );
        })}
      </div>

      {/* UPGRADED SHIPS or SOLAR POWERS */}
      {species === 'Ancient' ? (
        solarPowers.length > 0 && (
          <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
            <div className="absolute border-[var(--shapeships-grey-70)] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
            <SectionHeader
              title="Solar Powers"
              note="Each requires the energy shown to be cast."
            />
            {solarPowers.map((ship, index) => (
              <ShipRow key={ship.id} ship={ship} isAlternate={index % 2 === 1} />
            ))}
          </div>
        )
      ) : (
        upgradedShips.length > 0 && (
          <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
            <div className="absolute border-[var(--shapeships-grey-70)] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
            <SectionHeader
              title="Upgraded Ships"
              note={species === 'Xenite' ? 'Xenites within upgraded ships cannot be Evolved and do NOT count for Mantis and Hell Hornet powers.' : undefined}
            />
            {upgradedShips.map((ship, index) => (
              <ShipRow key={ship.id} ship={ship} isAlternate={index % 2 === 1} />
            ))}
          </div>
        )
      )}

      {/* Next: [Species] Button */}
      <div className="content-stretch relative flex shrink-0 flex-col items-start">
        <button
          className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onNavigate?.(navigation.next)}
        >
          <p className="font-bold leading-[normal] relative shrink-0 text-[13.5px] text-black text-nowrap sm:text-[18px]">
            Next: {navigation.label}
          </p>
        </button>
      </div>
    </div>
  );
}
