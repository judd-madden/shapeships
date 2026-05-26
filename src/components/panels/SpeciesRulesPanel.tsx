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
import { BuildIcon } from '../ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../ui/primitives/icons/BattleIcon';
import { resolveShipGraphic } from '../../game/display/graphics/resolveShipGraphic';

type RulesTab = 'core' | 'human' | 'xenite' | 'centaur' | 'ancient' | 'timings';
type SpeciesName = 'Human' | 'Xenite' | 'Centaur' | 'Ancient';
type EnergyCostTextClass =
  | 'text-shapeships-pastel-red'
  | 'text-shapeships-pastel-green'
  | 'text-shapeships-pastel-blue';

interface EnergyCostRow {
  label: string;
  textClass: EnergyCostTextClass;
}

interface SpeciesRulesPanelProps {
  species: SpeciesName;
  onNavigate?: (tab: RulesTab) => void;
}

const SOLAR_POWER_NAME_TEXT_CLASSES: Record<string, EnergyCostTextClass> = {
  Asteroid: 'text-shapeships-pastel-red',
  Supernova: 'text-shapeships-pastel-red',
  Life: 'text-shapeships-pastel-green',
  'Star Birth': 'text-shapeships-pastel-green',
  Convert: 'text-shapeships-pastel-blue',
  Simulacrum: 'text-shapeships-pastel-blue',
};

// Build/Battle icon mapping from CSV subphase (UI-ONLY INTERPRETATION)
// Note: Automatic and Charge Declaration are treated as Battle icons for UI consistency
// and do not imply exact engine timing.
function getPhaseIcon(subphase: string): 'build' | 'battle' {
  const buildSubphases = [
    'Dice Manipulation',
    'Line Generation',
    'Ships That Build',
    'Drawing',
    'End of Build Phase',
  ];

  const battleSubphases = [
    'First Strike',
    'Charge Declaration',
    'Automatic',
    'Upon Destruction',
    'Energy',
    'Solar',
    'End of Battle Phase',
  ];

  if (buildSubphases.some((s) => subphase.includes(s))) {
    return 'build';
  }

  if (battleSubphases.some((s) => subphase.includes(s))) {
    return 'battle';
  }

  // Default to battle for unknown subphases
  return 'battle';
}

// Get subphase label (display only, comma-separated, uppercase)
// Deduplicates subphases, preserves order of first appearance
function getSubphaseLabel(ship: ShipDefinitionUI): string {
  const seen = new Set<string>();
  const uniqueSubphases: string[] = [];

  for (const power of ship.powers) {
    const subphase = power.subphase;
    // Skip empty values and N/A
    if (!subphase || subphase.trim() === '' || subphase.toUpperCase() === 'N/A') {
      continue;
    }

    const normalized = subphase.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueSubphases.push(normalized);
    }
  }

  return uniqueSubphases.join(', ');
}

// Convert literal \n sequences to real newlines at UI boundary
// Power text is stored with literal "\\n" sequences in the data layer
function renderPowerText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

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
      textClass: 'text-shapeships-pastel-red',
    });
  }

  // Green energy
  if (cost.green > 0) {
    rows.push({
      label: `${cost.green} green energy`,
      textClass: 'text-shapeships-pastel-green',
    });
  }

  // Blue energy (either X blue or numeric blue)
  if (cost.xBlue) {
    rows.push({
      label: 'X blue energy',
      textClass: 'text-shapeships-pastel-blue',
    });
  } else if (cost.blue > 0) {
    rows.push({
      label: `${cost.blue} blue energy`,
      textClass: 'text-shapeships-pastel-blue',
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

function SectionHeader({
  title,
  note,
  showPhaseLegend = false,
  battleOnly = false,
}: {
  title: string;
  note?: string;
  showPhaseLegend?: boolean;
  battleOnly?: boolean;
}) {
  return (
    <>
      <div className="bg-[var(--shapeships-grey-70)] relative shrink-0 w-full">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch relative flex size-full flex-col items-start justify-between gap-[16px] px-[20px] py-[16px] sm:px-[32px] sm:py-[19px] md:flex-row md:items-center">
            <p className="font-bold leading-[normal] relative shrink-0 text-[15px] text-white uppercase sm:text-[22px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              {title}
            </p>
            {showPhaseLegend && battleOnly && (
              <div className="content-stretch relative flex w-full flex-wrap items-center justify-start gap-[16px] md:w-auto md:justify-end md:gap-[28px]">
                <div className="content-stretch relative flex gap-[8px] items-center shrink-0">
                  <div className="relative shrink-0 size-[36.994px]">
                    <BattleIcon className="w-full h-full" color="white" />
                  </div>
                  <p className="font-medium leading-[15.6px] relative text-[11.27px] text-white max-w-[145.666px] sm:text-[15.029px] sm:leading-[20.809px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Powers that occur in the <span className="font-extrabold">Battle Phase.</span>
                  </p>
                </div>
              </div>
            )}
            {showPhaseLegend && !battleOnly && (
              <div className="content-stretch relative flex w-full flex-wrap items-center justify-start gap-[16px] md:w-auto md:justify-end md:gap-[28px]">
                <div className="content-stretch relative flex gap-[8px] items-center shrink-0">
                  <div className="relative shrink-0 size-[36.994px]">
                    <BuildIcon className="w-full h-full" color="#D5D5D5" />
                  </div>
                  <p className="font-medium leading-[15.6px] relative text-[11.27px] text-white max-w-[141.041px] sm:text-[15.029px] sm:leading-[20.809px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Powers that occur in the <span className="font-extrabold">Build Phase.</span>
                  </p>
                </div>
                <div className="content-stretch relative flex gap-[8px] items-center shrink-0">
                  <div className="relative shrink-0 size-[36.994px]">
                    <BattleIcon className="w-full h-full" color="white" />
                  </div>
                  <p className="font-medium leading-[15.6px] relative text-[11.27px] text-white max-w-[145.666px] sm:text-[15.029px] sm:leading-[20.809px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Powers that occur in the <span className="font-extrabold">Battle Phase.</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {note && (
        <div className="bg-[var(--shapeships-grey-90)] relative flex min-h-[52px] shrink-0 w-full items-center px-[20px] py-[12px] sm:px-[32px]">
          <p className="font-normal italic leading-[15px] text-[12px] text-white sm:text-[16px] sm:leading-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
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

  return (
    <div className={`relative shrink-0 w-full ${isAlternate ? 'bg-[var(--shapeships-grey-90)]' : ''}`}>
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch relative flex w-full flex-col items-start gap-[24px] px-[16px] py-[24px] sm:px-[24px] lg:flex-row lg:gap-[20px] xl:gap-[12px] xl:py-[30px] xl:pr-[30px]">
          {/* Ship Graphic */}
          <div className="content-stretch relative flex min-h-[60px] w-full shrink-0 flex-col items-start justify-start lg:w-[190px] lg:items-center lg:justify-center xl:w-[215px]">
            {ShipGraphic && <ShipGraphic className="max-w-full h-auto" />}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[20px] lg:flex-row xl:gap-[12px]">
            {/* Ship Info */}
            <div className="content-stretch relative flex min-w-0 gap-[16px] items-start lg:w-[210px] lg:shrink-0">
              {/* Cost display */}
              {totalCost !== null && (
                <p className="font-black leading-[normal] relative shrink-0 text-[19.27px] text-right text-white w-[30px] sm:text-[25.691px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  {totalCost}
                </p>
              )}

              {/* Name, Energy Cost (Ancient Solar Powers), Joining Cost (if upgraded), and Subphase */}
              <div className="basis-0 content-stretch relative flex min-h-px min-w-0 grow shrink-0 flex-col items-start gap-[2px]">
                <p className={`font-bold leading-[19.27px] relative shrink-0 text-[15px] sm:text-[20px] sm:leading-[25.691px] ${solarPowerNameTextClass} w-full`} style={{ fontVariationSettings: "'wdth' 100" }}>
                  {ship.name}
                </p>
                {energyCostRows.length > 0 && (
                  <div className="pb-[6px] relative shrink-0">
                    {energyCostRows.map((row) => (
                      <p key={row.label} className={`font-normal leading-[13.5px] ${row.textClass} text-[10.5px] sm:text-[14px] sm:leading-[18px]`} style={{ fontVariationSettings: "'wdth' 100" }}>
                        {row.label}
                      </p>
                    ))}
                  </div>
                )}
                {isUpgradedShip && joiningCost !== null && joiningCost !== undefined && (
                  <p className="font-normal leading-[18px] pb-[6px] relative shrink-0 text-[var(--shapeships-grey-20)] text-[13.5px] sm:text-[18px] sm:leading-[24px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    (+{joiningCost})
                  </p>
                )}
                <p className="font-normal leading-[11.5px] relative shrink-0 text-[var(--shapeships-grey-20)] text-[10.5px] w-full sm:text-[13px] sm:leading-[14.13px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  {getSubphaseLabel(ship)}
                </p>
              </div>
            </div>

            {/* Powers */}
            <div className="content-stretch relative flex min-w-0 flex-1 flex-col items-start">
              {ship.powers.map((power, index) => {
                const phaseType = getPhaseIcon(power.subphase);

                return (
                  <div key={index} className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full">
                    {/* Phase icon */}
                    <div className="relative shrink-0 size-[25.691px]">
                      {phaseType === 'build' ? (
                        <div className="opacity-50">
                          <BuildIcon className="w-full h-full" color="#D5D5D5" />
                        </div>
                      ) : (
                        <div className="opacity-50">
                          <BattleIcon className="w-full h-full" color="#D5D5D5" />
                        </div>
                      )}
                    </div>

                    {/* Power text (preserve CSV wording exactly) */}
                    <p className="basis-0 font-normal grow leading-[20px] min-h-px min-w-0 relative shrink-0 text-[13.5px] pb-[10px] text-white whitespace-pre-wrap sm:text-[18px] sm:leading-[26px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                      {renderPowerText(power.text)}
                    </p>
                  </div>
                );
              })}

              {/* Evolved Ships Display (CSV-driven: shipType === 'Basic - Evolved') */}
              {evolvedShips && evolvedShips.length > 0 && (
                <div className="relative shrink-0 w-full mt-[10px]">
                  <div className="flex flex-col gap-[16px] pb-[20px]">
                    {/* Evolved ships grid */}
                    <div className="flex flex-wrap gap-[20px] items-start pl-0 sm:pl-[20px] lg:gap-[32px] lg:pl-[35px]">
                      {evolvedShips.map((evolvedShip) => {
                        const evolvedGraphic = resolveShipGraphic(evolvedShip, { context: 'default' });
                        const EvolvedShipGraphic = evolvedGraphic?.component;
                        const evolvedSubphase = getSubphaseLabel(evolvedShip);

                        return (
                          <div key={evolvedShip.id} className="flex min-w-[220px] max-w-full gap-[12px] items-start">
                            {/* Evolved ship graphic */}
                            <div className="relative shrink-0 w-[48px] h-[48px] flex items-center justify-center">
                              {EvolvedShipGraphic && <EvolvedShipGraphic className="max-w-full h-auto" />}
                            </div>

                            {/* Evolved ship info */}
                            <div className="flex flex-col gap-[2px]">
                              <p className="font-bold leading-[15px] text-[12px] text-white sm:text-[16px] sm:leading-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                                {evolvedShip.name}
                              </p>
                              <p className="font-normal leading-[14px] text-[10.5px] text-[var(--shapeships-grey-20)] sm:text-[12px] sm:leading-[16px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                                {evolvedSubphase}
                              </p>
                              {evolvedShip.powers.map((power, idx) => {
                                const phaseType = getPhaseIcon(power.subphase);
                                return (
                                  <div key={idx} className="flex gap-[6px] items-start mt-[4px]">
                                    <div className="relative shrink-0 size-[16px]">
                                      {phaseType === 'build' ? (
                                        <div className="opacity-50">
                                          <BuildIcon className="w-full h-full" color="#D5D5D5" />
                                        </div>
                                      ) : (
                                        <div className="opacity-50">
                                          <BattleIcon className="w-full h-full" color="#D5D5D5" />
                                        </div>
                                      )}
                                    </div>
                                    <p className="font-normal leading-[13.5px] text-[10.5px] text-white sm:text-[14px] sm:leading-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                                      {renderPowerText(power.text)}
                                    </p>
                                  </div>
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
                    <div className="content-stretch relative flex w-full items-center pl-0 pr-0 py-0 sm:pl-[20px] lg:pl-[35px]">
                      <p className="basis-0 font-normal grow italic leading-[15px] min-h-px min-w-px relative shrink-0 text-[12px] text-white whitespace-pre-wrap sm:text-[16px] sm:leading-[20px]" style={{ fontVariationSettings: "'wdth' 100" }}>
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
    <div className="content-stretch flex flex-col gap-[48px] items-start relative shrink-0 w-full">
      {/* Page Header */}
      <div className="content-stretch relative flex size-full flex-col items-start justify-between gap-[16px] text-white md:flex-row md:items-end" data-name="Rules Header">
        <div className="content-stretch relative flex flex-wrap items-center gap-x-[20px] gap-y-[8px]" data-name="Species">
          <p className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[24px] sm:text-[36px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {speciesData.displayName}
          </p>
          <p className="font-['Roboto'] font-semibold leading-[normal] not-italic relative shrink-0 text-[13.5px] sm:text-[20px]">
            <span className="font-['Roboto'] font-normal text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`from `}</span>
            <span className="font-['Roboto'] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
              {getSpeciesOrigin(species)}
            </span>
          </p>
        </div>
        <p className="font-['Roboto'] font-normal leading-[16.5px] relative shrink-0 text-[12px] w-full max-w-[255px] whitespace-pre-line sm:text-[16px] sm:leading-[22px] md:text-right" style={{ fontVariationSettings: "'wdth' 100" }}>
          {getSpeciesTagline(species)}
        </p>
      </div>

      {/* BASIC SHIPS */}
      <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="absolute border-[var(--shapeships-grey-70)] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
        <SectionHeader title="Basic Ships" showPhaseLegend={true} />
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
              showPhaseLegend={true}
              battleOnly={true}
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
              showPhaseLegend={true}
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
          <p className="font-bold leading-[normal] relative shrink-0 text-[13.5px] text-black text-nowrap sm:text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            Next: {navigation.label}
          </p>
        </button>
      </div>
    </div>
  );
}
