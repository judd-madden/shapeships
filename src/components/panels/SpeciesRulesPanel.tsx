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

interface SpeciesRulesPanelProps {
  species: SpeciesName;
  onNavigate?: (tab: RulesTab) => void;
}

// Build/Battle icon mapping from CSV subphase (UI-ONLY INTERPRETATION)
// Note: Automatic and Charge Declaration are treated as Battle icons for UI consistency
// and do not imply exact engine timing.
function getPhaseIcon(subphase: string): 'build' | 'battle' {
  const buildSubphases = [
    'Dice Manipulation',
    'Line Generation',
    'Ships That Build',
    'Drawing',
    'End of Build Phase'
  ];
  
  const battleSubphases = [
    'First Strike',
    'Charge Declaration',
    'Automatic',
    'Upon Destruction',
    'Energy',
    'Solar',
    'End of Battle Phase'
  ];
  
  if (buildSubphases.some(s => subphase.includes(s))) {
    return 'build';
  }
  
  if (battleSubphases.some(s => subphase.includes(s))) {
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

// Convert literal \\n sequences to real newlines at UI boundary
// Power text is stored with literal "\\n" sequences in the data layer
function renderPowerText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

// Get energy cost label (Ancient Solar Powers only)
// Reads from ship.energyCost field (canonical JSON data)
function getEnergyCostLabel(ship: ShipDefinitionUI): string | null {
  if (ship.species !== 'Ancient' || ship.shipType !== 'Solar Power') {
    return null;
  }
  
  if (!ship.energyCost) {
    return null;
  }
  
  const labels: string[] = [];
  const cost = ship.energyCost;
  
  // Red energy
  if (cost.red > 0) {
    labels.push(`${cost.red} red energy`);
  }
  
  // Green energy
  if (cost.green > 0) {
    labels.push(`${cost.green} green energy`);
  }
  
  // Blue energy (either X blue or numeric blue)
  if (cost.xBlue) {
    labels.push('X blue energy');
  } else if (cost.blue > 0) {
    labels.push(`${cost.blue} blue energy`);
  }
  
  // Return multi-line string (will be rendered with whitespace-pre-line)
  return labels.length > 0 ? labels.join('\n') : null;
}

// Section header component
function SectionHeader({ 
  title,
  note,
  showPhaseLegend = false,
  battleOnly = false
}: { 
  title: string;
  note?: string;
  showPhaseLegend?: boolean;
  battleOnly?: boolean;
}) {
  return (
    <>
      <div className="bg-[#555] h-[80px] relative shrink-0 w-full">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex items-center justify-between px-[32px] py-[19px] relative size-full">
            <p className="font-bold leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white uppercase" style={{ fontVariationSettings: "'wdth' 100" }}>
              {title}
            </p>
            {showPhaseLegend && battleOnly && (
              <div className="content-stretch flex gap-[28px] items-center justify-end relative shrink-0">
                <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
                  <div className="relative shrink-0 size-[36.994px]">
                    <BattleIcon className="w-full h-full" color="white" />
                  </div>
                  <p className="font-medium leading-[20.809px] relative shrink-0 text-[15.029px] text-white w-[145.666px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Powers that occur in the <span className="font-extrabold">Battle Phase.</span>
                  </p>
                </div>
              </div>
            )}
            {showPhaseLegend && !battleOnly && (
              <div className="content-stretch flex gap-[28px] items-center justify-end relative shrink-0">
                <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
                  <div className="relative shrink-0 size-[36.994px]">
                    <BuildIcon className="w-full h-full" color="#D5D5D5" />
                  </div>
                  <p className="font-medium leading-[20.809px] relative shrink-0 text-[15.029px] text-white w-[141.041px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Powers that occur in the <span className="font-extrabold">Build Phase.</span>
                  </p>
                </div>
                <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
                  <div className="relative shrink-0 size-[36.994px]">
                    <BattleIcon className="w-full h-full" color="white" />
                  </div>
                  <p className="font-medium leading-[20.809px] relative shrink-0 text-[15.029px] text-white w-[145.666px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                    Powers that occur in the <span className="font-extrabold">Battle Phase.</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {note && (
        <div className="bg-[#212121] relative shrink-0 w-full h-[52px] flex items-center px-[32px]">
          <p className="font-normal italic leading-[20px] text-[16px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
            {note}
          </p>
        </div>
      )}
    </>
  );
}

// Ship row component
function ShipRow({ 
  ship, 
  isAlternate,
  evolvedShips
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
  const energyCostLabel = getEnergyCostLabel(ship);
  
  return (
    <div className={`relative shrink-0 w-full ${isAlternate ? 'bg-[#212121]' : ''}`}>
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-start pl-[16px] pr-[30px] py-[30px] relative w-full">
          {/* Ship Graphic */}
          <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 w-[215px] min-h-[60px]">
            {ShipGraphic && <ShipGraphic className="max-w-full h-auto" />}
          </div>
          
          {/* Ship Info */}
          <div className="content-stretch flex gap-[16px] items-start relative shrink-0 w-[210px]">
            {/* Cost display */}
            {totalCost !== null && (
              <p className="font-black leading-[normal] relative shrink-0 text-[25.691px] text-right text-white w-[30px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                {totalCost}
              </p>
            )}
            
            {/* Name, Energy Cost (Ancient Solar Powers), Joining Cost (if upgraded), and Subphase */}
            <div className="basis-0 content-stretch flex flex-col gap-[2px] grow items-start min-h-px min-w-px relative shrink-0">
              <p className="font-bold leading-[25.691px] relative shrink-0 text-[20px] text-white w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                {ship.name}
              </p>
              {energyCostLabel && (
                <p className="font-normal leading-[18px] pb-[6px] relative shrink-0 text-[#d4d4d4] text-[14px] whitespace-pre-line" style={{ fontVariationSettings: "'wdth' 100" }}>
                  {energyCostLabel}
                </p>
              )}
              {isUpgradedShip && joiningCost !== null && joiningCost !== undefined && (
                <p className="font-normal leading-[24px] pb-[6px] relative shrink-0 text-[#d4d4d4] text-[18px]" style={{ fontVariationSettings: "'wdth' 100" }}>
                  (+{joiningCost})
                </p>
              )}
              <p className="font-normal leading-[14.13px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
                {getSubphaseLabel(ship)}
              </p>
            </div>
          </div>
          
          {/* Powers */}
          <div className="content-stretch flex flex-col items-start relative shrink-0 w-[505px]">
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
                  <p className="basis-0 font-normal grow leading-[26px] min-h-px min-w-px relative shrink-0 text-[18px] pb-[10px] text-white whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
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
                  <div className="flex gap-[32px] pl-[35px] items-start">
                    {evolvedShips.map((evolvedShip) => {
                      const evolvedGraphic = resolveShipGraphic(evolvedShip, { context: 'default' });
                      const EvolvedShipGraphic = evolvedGraphic?.component;
                      const evolvedSubphase = getSubphaseLabel(evolvedShip);
                      
                      return (
                        <div key={evolvedShip.id} className="flex gap-[12px] items-start">
                          {/* Evolved ship graphic */}
                          <div className="relative shrink-0 w-[48px] h-[48px] flex items-center justify-center">
                            {EvolvedShipGraphic && <EvolvedShipGraphic className="max-w-full h-auto" />}
                          </div>
                          
                          {/* Evolved ship info */}
                          <div className="flex flex-col gap-[2px]">
                            <p className="font-bold leading-[20px] text-[16px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                              {evolvedShip.name}
                            </p>
                            <p className="font-normal leading-[16px] text-[12px] text-[#d4d4d4]" style={{ fontVariationSettings: "'wdth' 100" }}>
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
                                  <p className="font-normal leading-[18px] text-[14px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
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
                  
                  {/* Evolved ships note */}
                  <p className="font-normal italic leading-[18px] pl-[35px] text-[16px] text-white" style={{ fontVariationSettings: "'wdth' 100" }}>
                    These ships still count as Xenite ship type, with a cost of 2.
                  </p>
                </div>
              </div>
            )}
            
            {/* Extra rules / notes */}
            {ship.extraRules && (
              <div className="relative shrink-0 w-full">
                <div className="flex flex-row items-center size-full">
                  <div className="content-stretch flex items-center pl-[35px] pr-0 py-0 relative w-full">
                    <p className="basis-0 font-normal grow italic leading-[20px] min-h-px min-w-px relative shrink-0 text-[16px] text-white whitespace-pre-wrap" style={{ fontVariationSettings: "'wdth' 100" }}>
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
  );
}

// Navigation mapping
const SPECIES_NAVIGATION: Record<SpeciesName, { next: RulesTab; label: string }> = {
  Human: { next: 'xenite', label: 'Xenite' },
  Xenite: { next: 'centaur', label: 'Centaur' },
  Centaur: { next: 'ancient', label: 'Ancient' },
  Ancient: { next: 'timings', label: 'Turn Timings' }
};

export function SpeciesRulesPanel({ species, onNavigate }: SpeciesRulesPanelProps) {
  // Filter ships by species
  const speciesShips = SHIP_DEFINITIONS.filter(ship => ship.species === species);
  
  // Categorize ships
  // Separate 'Basic - Evolved' ships (Oxite, Asterite) from regular basic ships
  const basicShipsOnly = speciesShips.filter(ship => ship.shipType === 'Basic');
  const evolvedShips = speciesShips.filter(ship => ship.shipType === 'Basic - Evolved');
  const upgradedShips = speciesShips.filter(ship => ship.shipType === 'Upgraded');
  const solarPowers = speciesShips.filter(ship => ship.shipType === 'Solar Power');
  
  // Navigation
  const navigation = SPECIES_NAVIGATION[species];
  
  // Species-specific metadata (hardcoded)
  const speciesMetadata: Record<string, { origin: string; tagline: string }> = {
    'Human': { 
      origin: 'Sol', 
      tagline: 'Metal. Explosions. Expansion.\nOnward and upward.' 
    },
    'Xenite': { 
      origin: 'Xenon', 
      tagline: 'Swarm. Queen. Hive.\nAlways growing.' 
    },
    'Centaur': { 
      origin: 'Alpha Centauri', 
      tagline: 'Power. Timing. Domination.\nCull the weak.' 
    },
    'Ancient': { 
      origin: 'Sol', 
      tagline: 'Energy. Solar Powers.\nEver present.' 
    }
  };
  
  const metadata = speciesMetadata[species] || { origin: '', tagline: '' };
  
  // Helper functions to get species origin and tagline
  function getSpeciesOrigin(species: SpeciesName): string {
    return speciesMetadata[species]?.origin || '';
  }

  function getSpeciesTagline(species: SpeciesName): string {
    return speciesMetadata[species]?.tagline || '';
  }

  // Species display name mapping
  const speciesDisplayName: Record<SpeciesName, string> = {
    'Human': 'Human',
    'Xenite': 'Xenite',
    'Centaur': 'Centaur',
    'Ancient': 'Ancient'
  };

  const speciesData = {
    displayName: speciesDisplayName[species] || species
  };
  
  return (
    <div className="content-stretch flex flex-col gap-[48px] items-start relative shrink-0 w-full">
      {/* Page Header */}
      <div className="content-stretch flex items-center justify-between relative size-full text-white" data-name="Rules Header">
        <div className="content-stretch flex gap-[20px] items-center relative shrink-0 text-nowrap" data-name="Species">
          <p className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[36px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {speciesData.displayName}
          </p>
          <p className="font-['Roboto'] font-semibold leading-[normal] not-italic relative shrink-0 text-[20px] text-right">
            <span className="font-['Roboto'] font-normal text-white" style={{ fontVariationSettings: "'wdth' 100" }}>{`from `}</span>
            <span className="font-['Roboto'] font-semibold" style={{ fontVariationSettings: "'wdth' 100" }}>
              {getSpeciesOrigin(species)}
            </span>
          </p>
        </div>
        <p className="font-['Roboto'] font-normal h-[49px] leading-[22px] relative shrink-0 text-[16px] text-right w-[255px] whitespace-pre-line" style={{ fontVariationSettings: "'wdth' 100" }}>
          {getSpeciesTagline(species)}
        </p>
      </div>

      {/* BASIC SHIPS */}
      <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="absolute border-[#555] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
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
        // Ancient: SOLAR POWERS section
        solarPowers.length > 0 && (
          <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
            <div className="absolute border-[#555] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
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
        // Other species: UPGRADED SHIPS section
        upgradedShips.length > 0 && (
          <div className="bg-black content-stretch flex flex-col items-start relative shrink-0 w-full">
            <div className="absolute border-[#555] border-t-[5px] border-l-[3px] border-r-[3px] border-b-[3px] border-solid inset-[-3px] pointer-events-none" />
            <SectionHeader 
              title="Upgraded Ships"
              note={species === 'Xenite' ? "Xenites within upgraded ships cannot be Evolved and do NOT count for Mantis and Hell Hornet powers." : undefined}
              showPhaseLegend={true}
            />
            {upgradedShips.map((ship, index) => (
              <ShipRow key={ship.id} ship={ship} isAlternate={index % 2 === 1} />
            ))}
          </div>
        )
      )}

      {/* Next: [Species] Button */}
      <div className="content-stretch flex flex-col items-start relative shrink-0">
        <button 
          className="bg-white content-stretch flex items-center justify-center px-[30px] py-[20px] relative rounded-[10px] shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onNavigate?.(navigation.next)}
        >
          <p className="font-bold leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap" style={{ fontVariationSettings: "'wdth' 100" }}>
            Next: {navigation.label}
          </p>
        </button>
      </div>
    </div>
  );
}