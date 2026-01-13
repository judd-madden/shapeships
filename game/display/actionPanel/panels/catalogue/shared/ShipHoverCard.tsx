/**
 * Ship Hover Card (SMART, portal-rendered)
 * 
 * PASS 2: Full implementation with rules from JSON + eligibility feedback
 * - Renders via portal into #ship-hover-layer
 * - Displays ship rules from ShipDefinitionsUI
 * - Shows build eligibility or opponent-view mode
 * - No mouse-following (anchored to hitbox)
 */

import * as ReactDOM from 'react-dom';
import { BuildIcon } from '../../../../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../../../../components/ui/primitives/icons/BattleIcon';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import type { ShipDefinitionUI } from '../../../../../types/ShipTypes.ui';
import type { ShipEligibility } from './ShipBuildEligibility';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';

// NOTE (PASS 2): This hover card is now a smart component with portal rendering.
// Positioning is anchored to the ship hitbox via anchorRect.
// The card escapes ActionPanel bounds via portal to #ship-hover-layer.

interface ShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
  isOpponentView: boolean;
  eligibility: ShipEligibility;
}

// Helper functions (inlined from ShipRulesAdapter to avoid module loading issues)

type PowerIcon = 'build' | 'battle';

interface ShipPowerViewModel {
  icon: PowerIcon;
  text: string;
}

interface ShipHoverModel {
  name: string;
  cost: number;
  joiningLines?: number;
  phaseLabel?: string;
  powers: ShipPowerViewModel[];
  italicNotes?: string;
  componentShipIds: ShipDefId[];
}

function getPhaseIcon(subphase: string): PowerIcon {
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
  
  return 'battle';
}

function renderPowerText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

function getSubphaseLabel(ship: ShipDefinitionUI): string {
  const seen = new Set<string>();
  const uniqueSubphases: string[] = [];
  
  for (const power of ship.powers) {
    const subphase = power.subphase;
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

function getShipHoverModel(shipId: ShipDefId): ShipHoverModel | null {
  const ship = SHIP_DEFINITIONS_MAP?.[shipId];
  
  if (!ship) {
    console.warn(`[ShipHoverCard] Ship not found: ${shipId}`);
    if (process.env.NODE_ENV === 'development') {
      console.log('[ShipHoverCard] SHIP_DEFINITIONS_MAP keys sample:', Object.keys(SHIP_DEFINITIONS_MAP || {}).slice(0, 10));
    }
    return null;
  }
  
  const cost = ship.totalLineCost ?? 0;
  const joiningLines = ship.joiningLineCost && ship.joiningLineCost > 0 
    ? ship.joiningLineCost 
    : undefined;
  
  const phaseLabel = getSubphaseLabel(ship);
  
  const powers: ShipPowerViewModel[] = ship.powers.map(power => ({
    icon: getPhaseIcon(power.subphase),
    text: renderPowerText(power.text)
  }));
  
  const italicNotes = ship.extraRules || undefined;
  const componentShipIds = ship.componentShips || [];
  
  return {
    name: ship.name,
    cost,
    joiningLines,
    phaseLabel,
    powers,
    italicNotes,
    componentShipIds
  };
}

/**
 * Group duplicate ship IDs into counts
 * Input: ["DEF","DEF","FIG"] → Output: [{id:"DEF",count:2},{id:"FIG",count:1}]
 * Preserves first-seen order for predictable display
 */
function groupShipCounts(shipIds: ShipDefId[]): Array<{ id: ShipDefId; count: number }> {
  const seen = new Map<ShipDefId, number>();
  const order: ShipDefId[] = [];
  
  for (const id of shipIds) {
    if (!seen.has(id)) {
      order.push(id);
      seen.set(id, 1);
    } else {
      seen.set(id, seen.get(id)! + 1);
    }
  }
  
  return order.map(id => ({ id, count: seen.get(id)! }));
}

/**
 * Component ship display (graphics only, no text names)
 * Single ships: Just the graphic
 * Multiple ships: Graphic + count number
 */
function ComponentShips({ shipIds }: { shipIds: ShipDefId[] }) {
  if (shipIds.length === 0) return null;
  
  const grouped = groupShipCounts(shipIds);
  
  return (
    <div className="content-center flex flex-wrap gap-[16px] items-center relative shrink-0">
      {grouped.map(({ id, count }) => {
        const ship = SHIP_DEFINITIONS_MAP?.[id];
        if (!ship) return null;
        
        const graphic = ship.graphics?.find(g => g.condition === 'default') || ship.graphics?.[0];
        const ShipGraphic = graphic?.component;
        
        // Single ship: Just the graphic
        if (count === 1) {
          return (
            <div key={id} className="relative shrink-0 size-[22px]">
              {ShipGraphic && <ShipGraphic className="max-w-full max-h-full" />}
            </div>
          );
        }
        
        // Multiple ships: Graphic + count number
        return (
          <div key={id} className="content-stretch flex gap-[6px] items-center relative shrink-0">
            <div className="relative shrink-0 size-[22px]">
              {ShipGraphic && <ShipGraphic className="max-w-full max-h-full" />}
            </div>
            <p
              className="font-black leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {count}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Eligibility footer section
 */
function EligibilityFooter({ eligibility }: { eligibility: ShipEligibility }) {
  // Opponent view: no footer
  if (eligibility.state === 'OPPONENT_VIEW') {
    return null;
  }
  
  // CAN_BUILD
  if (eligibility.state === 'CAN_BUILD') {
    return (
      <p
        className="font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Click to build
      </p>
    );
  }
  
  // NEED_COMPONENTS
  if (eligibility.state === 'NEED_COMPONENTS') {
    return (
      <>
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Need component ships
        </p>
        <ComponentShips shipIds={eligibility.missingComponentShipIds || []} />
      </>
    );
  }
  
  // NOT_ENOUGH_LINES
  if (eligibility.state === 'NOT_ENOUGH_LINES') {
    return (
      <p
        className="font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Not enough lines
      </p>
    );
  }
  
  // MAX_LIMIT
  if (eligibility.state === 'MAX_LIMIT') {
    return (
      <p
        className="font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Maximum ship limit, cannot build
      </p>
    );
  }
  
  return null;
}

/**
 * Power text component with proper nudging
 */
function PowerText({ text }: { text: string }) {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-center min-h-px min-w-px pb-0 pt-[2px] px-0 relative shrink-0">
      <p
        className="basis-0 font-normal grow leading-[18px] min-h-px min-w-px relative shrink-0 text-[16px] text-white whitespace-pre-wrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * Main hover card component
 */
export function ShipHoverCard({ shipId, anchorRect, isOpponentView, eligibility }: ShipHoverCardProps) {
  const model = getShipHoverModel(shipId);
  
  if (!model) {
    console.warn(`[ShipHoverCard] No model for ship: ${shipId}`);
    return null;
  }
  
  // Portal target
  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    console.warn('[ShipHoverCard] Portal target #ship-hover-layer not found');
    return null;
  }
  
  // FIXED WIDTH: All hover cards are 320px wide
  const CARD_WIDTH = 320;
  
  // Position card centered horizontally with ship, above by small margin
  const shipCenterX = anchorRect.left + (anchorRect.width / 2);
  const left = shipCenterX - (CARD_WIDTH / 2);
  const top = anchorRect.top - 8; // 8px margin above ship (card grows upward from this point)
  
  const cardContent = (
    <div
      className="absolute bg-[#212121] content-stretch flex flex-col gap-[12px] items-start pb-[20px] pt-[16px] px-[20px] rounded-[10px]"
      style={{ 
        left: `${left}px`, 
        top: `${top}px`,
        width: `${CARD_WIDTH}px`,
        transform: 'translateY(-100%)' // Shift card up by its own height so bottom edge is at 'top'
      }}
    >
      {/* Border overlay */}
      <div
        aria-hidden="true"
        className="absolute border border-[#555] border-solid inset-0 pointer-events-none rounded-[10px]"
      />
      
      {/* Top Section: Cost + Name + Phase */}
      <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
        {/* Cost + Name */}
        <div className="content-stretch flex gap-[6px] items-center leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white w-full">
          <p
            className="font-black relative shrink-0"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {model.cost}
          </p>
          <p
            className="font-bold relative shrink-0"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {model.name}
          </p>
        </div>
        
        {/* Phase Label */}
        {model.phaseLabel && (
          <p
            className="font-normal leading-[15px] relative shrink-0 text-[#d4d4d4] text-[13px] w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {model.phaseLabel}
          </p>
        )}
      </div>
      
      {/* Joining Lines */}
      {model.joiningLines && (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[#888] text-[15px] text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          <span className="font-bold" style={{ fontVariationSettings: "'wdth' 100" }}>
            {model.joiningLines}
          </span>
          <span className="font-normal" style={{ fontVariationSettings: "'wdth' 100" }}>
            {' joining lines'}
          </span>
        </p>
      )}
      
      {/* Powers */}
      {model.powers.length > 0 && (
        <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
          {model.powers.map((power, index) => (
            <div key={index} className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full">
              {power.icon === 'build' ? <BuildIcon /> : <BattleIcon />}
              <PowerText text={power.text} />
            </div>
          ))}
        </div>
      )}
      
      {/* Italic Notes */}
      {model.italicNotes && (
        <div className="content-stretch flex items-center relative shrink-0 w-full">
          <p
            className="basis-0 font-normal grow italic leading-[18px] min-h-px min-w-px relative shrink-0 text-[13px] text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {model.italicNotes}
          </p>
        </div>
      )}
      
      {/* Divider */}
      <div className="h-0 relative shrink-0 w-full">
        <div className="absolute inset-[-1px_0_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 260 1">
            <line stroke="#555555" x2="260" y1="0.5" y2="0.5" />
          </svg>
        </div>
      </div>
      
      {/* Eligibility Footer */}
      <EligibilityFooter eligibility={eligibility} />
    </div>
  );
  
  return ReactDOM.createPortal(cardContent, portalTarget);
}