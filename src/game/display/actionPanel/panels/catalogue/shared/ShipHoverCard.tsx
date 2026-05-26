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
import type { ShipEligibility } from './ShipBuildEligibility';
import { getShipCardModel, groupShipCounts as groupShipTokenCounts } from './ShipCardModel';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';
import { parseShipToken } from '../../../../graphics/shipToken';
import { resolveShipGraphic } from '../../../../graphics/resolveShipGraphic';
import { isShipDefId } from '../../../../../data/ShipDefinitions.core';
import { useAnchoredHoverPlacement } from '../../../../shared/useAnchoredHoverPlacement';

// NOTE (PASS 2): This hover card is now a smart component with portal rendering.
// Positioning is anchored to the ship hitbox via anchorRect.

interface ShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
  eligibility: ShipEligibility;
}

const TAIL_SIZE_PX = 12;

/**
 * Component ship display (graphics only, no text names)
 * Token-aware: Parses CAR(0) → baseId CAR + explicitCharges 0
 * Hover context: Shows depleted graphics for charge ships
 */
function ComponentShips({ shipIds }: { shipIds: readonly string[] }) {
  if (shipIds.length === 0) return null;
  
  const grouped = groupShipTokenCounts(shipIds);
  
  return (
    <div className="content-center flex flex-wrap gap-[16px] items-center relative shrink-0">
      {grouped.map(({ token, count }) => {
        // Parse token to get base ID and explicit charges
        const { baseId, explicitCharges } = parseShipToken(token);
        
        // Lookup ship by canonical base ID
        if (!isShipDefId(baseId)) {
          console.warn(`[ShipHoverCard] Invalid ship id for token: ${token} (baseId: ${baseId})`);
          return null;
        }

        const ship = SHIP_DEFINITIONS_MAP?.[baseId];
        if (!ship) {
          console.warn(`[ShipHoverCard] Ship not found for token: ${token} (baseId: ${baseId})`);
          return null;
        }
        
        // Resolve graphic using hover context + explicit charges from token
        const graphic = resolveShipGraphic(ship, {
          context: 'hover',
          explicitCharges
        });
        
        const ShipGraphic = graphic?.component;
        
        // Single ship: Just the graphic
        if (count === 1) {
          return (
            <div key={token} className="relative shrink-0 h-[22px]">
              {ShipGraphic && <ShipGraphic className="h-full w-auto max-w-none" />}
            </div>
          );
        }
        
        // Multiple ships: Graphic + count number
        return (
          <div key={token} className="content-stretch flex gap-[6px] items-center relative shrink-0">
            <div className="relative shrink-0 h-[22px]">
              {ShipGraphic && <ShipGraphic className="h-full w-auto max-w-none" />}
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
function EligibilityFooter({
  eligibility,
  componentShipIds,
}: {
  eligibility: ShipEligibility;
  componentShipIds: readonly string[];
}) {
  const footerContent = (() => {
    if (eligibility.state === 'REFERENCE_ONLY') {
      if (componentShipIds.length === 0) {
        return null;
      }

      return <ComponentShips shipIds={componentShipIds} />;
    }

    if (eligibility.state === 'BUILD_STATE_UNAVAILABLE') {
      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Build in Drawing Phase
        </p>
      );
    }

    if (eligibility.state === 'CAN_BUILD') {
      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Click to build
        </p>
      );
    }

    if (eligibility.state === 'NEED_COMPONENTS') {
      return (
        <>
          <p
            className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Need component ships
          </p>
          <ComponentShips shipIds={eligibility.missingComponentShipIds || []} />
        </>
      );
    }

    if (eligibility.state === 'NOT_ENOUGH_LINES') {
      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Not enough lines
        </p>
      );
    }

    if (eligibility.state === 'MAX_LIMIT') {
      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Maximum limit reached
        </p>
      );
    }

    if (eligibility.state === 'RULE_RESTRICTED') {
      const message = eligibility.restrictionReason === 'FOREIGN_BASIC'
        ? 'Foreign basic ships cannot be built'
        : 'In development';

      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {message}
        </p>
      );
    }

    return null;
  })();

  if (!footerContent) {
    return null;
  }

  return (
    <>
      <div className="h-0 relative shrink-0 w-full">
        <div className="absolute inset-[-1px_0_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 260 1">
            <line stroke="var(--shapeships-grey-70)" x2="260" y1="0.5" y2="0.5" />
          </svg>
        </div>
      </div>
      {footerContent}
    </>
  );
}

/**
 * Power text component with proper nudging
 */
function PowerText({ text }: { text: string }) {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-center min-h-px min-w-px pb-0 pt-[2px] px-0 relative shrink-0">
      <p
        className="basis-0 font-normal grow leading-[20px] min-h-px min-w-px relative shrink-0 text-[16px] text-white whitespace-pre-wrap"
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
export function ShipHoverCard({ shipId, anchorRect, eligibility }: ShipHoverCardProps) {
  const model = getShipCardModel(shipId);
  const { placement, anchorX, anchorY, cardTransform, cardRef } =
    useAnchoredHoverPlacement(anchorRect);
  
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
  
  const cardContent = (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${anchorX}px`,
        top: `${anchorY}px`,
        width: '0px',
        height: '0px',
      }}
    >
      <div
        ref={cardRef}
        className="relative bg-[var(--shapeships-grey-90)] content-stretch flex w-[320px] flex-col gap-[12px] items-start rounded-[10px] px-[20px] pb-[20px] pt-[16px]"
        style={{
          pointerEvents: 'none',
          transform: cardTransform,
        }}
      >
        {/* Border overlay */}
        <div
          aria-hidden="true"
          className="absolute border border-[var(--shapeships-grey-70)] border-solid inset-0 pointer-events-none rounded-[10px]"
        />

        <div
          aria-hidden="true"
          className="absolute rotate-45 border-solid border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] pointer-events-none"
          style={
            placement === 'left'
              ? {
                  top: '50%',
                  right: '-6px',
                  width: `${TAIL_SIZE_PX}px`,
                  height: `${TAIL_SIZE_PX}px`,
                  transform: 'translateY(-50%)',
                  borderTopWidth: '1px',
                  borderRightWidth: '1px',
                }
              : {
                  left: 'calc(50% - 6px)',
                  top: 'calc(100% + 2px)',
                  width: `${TAIL_SIZE_PX}px`,
                  height: `${TAIL_SIZE_PX}px`,
                  transform: 'translate(-50%, -50%)',
                  borderBottomWidth: '1px',
                  borderRightWidth: '1px',
                }
          }
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
              className="font-normal leading-[15px] relative shrink-0 text-[var(--shapeships-grey-20)] text-[13px] w-full"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {model.phaseLabel}
            </p>
          )}
        </div>

        {/* Joining Lines */}
        {model.joiningLines && (
          <p
            className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
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
              className="basis-0 font-normal grow italic leading-[17px] min-h-px min-w-px relative shrink-0 text-[13px] text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {model.italicNotes}
            </p>
          </div>
        )}
        
        {/* Eligibility Footer */}
        <EligibilityFooter
          eligibility={eligibility}
          componentShipIds={model.componentShipIds}
        />
      </div>
    </div>
  );
  
  return ReactDOM.createPortal(cardContent, portalTarget);
}
