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
import { ChallengeIcon } from '../../../../../../components/ui/primitives/icons/ChallengeIcon';
import type { ActionPanelBuildCatalogueViewModel } from '../../../../../client/gameSession/types';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import type { ShipEligibility } from './ShipBuildEligibility';
import type { CatalogueChallengeCondition } from './CatalogueShipSlot';
import { getShipCardModel, groupShipCounts as groupShipTokenCounts } from './ShipCardModel';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';
import { parseShipToken } from '../../../../graphics/shipToken';
import { resolveShipGraphic } from '../../../../graphics/resolveShipGraphic';
import { isShipDefId } from '../../../../../data/ShipDefinitions.core';
import { ShipPowerTagBadgeRow } from '../../../../shared/ShipPowerTagBadgeRow';
import { HoverPanelFrame } from '../../../../shared/HoverPanelFrame';
import { useAnchoredHoverPlacement } from '../../../../shared/useAnchoredHoverPlacement';
import type { HoverPanelMotionState } from '../../../../shared/useHoverPanelPresence';
import { ShipPowerRow } from '../../../../shared/ShipPowerRow';

// NOTE (PASS 2): This hover card is now a smart component with portal rendering.
// Positioning is anchored to the ship hitbox via anchorRect.

export type ShipHoverHeadingValue = {
  label?: string;
  healing?: number;
  damage?: number;
};

export type ShipHoverActionHint =
  | 'build'
  | 'cast'
  | 'view';

interface ShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
  eligibility: ShipEligibility;
  actionHint?: Exclude<ShipHoverActionHint, 'build'>;
  motionState?: HoverPanelMotionState | null;
  showCost?: boolean;
  headingValue?: ShipHoverHeadingValue;
  showPhaseLabel?: boolean;
  catalogueChallengeIndicator?: ActionPanelBuildCatalogueViewModel['catalogueChallengeIndicator'];
}

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
function ActionHint({ kind }: { kind: ShipHoverActionHint }) {
  const label =
    kind === 'build'
      ? 'Click to Build'
      : kind === 'cast'
        ? 'Click to Cast'
        : 'Click to View';

  return (
    <p
      className="ss-catalogueActionHint relative shrink-0 text-[15px] font-black leading-[12px] text-nowrap"
    >
      {label}
    </p>
  );
}

function ChallengeRequirement({ condition }: { condition: CatalogueChallengeCondition }) {
  const colorClassName = condition === 'with'
    ? 'text-[var(--shapeships-pastel-green)]'
    : 'text-[var(--shapeships-pastel-red)]';

  return (
    <div className={`ml-auto flex shrink-0 items-center gap-[4px] ${colorClassName}`}>
      <ChallengeIcon className="h-auto w-[14px] shrink-0" />
      <p className="text-nowrap text-[15px] font-medium leading-[12px]">
        {condition === 'with' ? 'Win with' : 'Win without'}
      </p>
    </div>
  );
}

function EligibilityFooter({
  eligibility,
  componentShipIds,
  actionHint,
  challengeCondition,
}: {
  eligibility: ShipEligibility;
  componentShipIds: readonly string[];
  actionHint?: Exclude<ShipHoverActionHint, 'build'>;
  challengeCondition: CatalogueChallengeCondition | null;
}) {
  const resolvedActionHint: ShipHoverActionHint | undefined =
    actionHint ??
    (eligibility.state === 'CAN_BUILD' ? 'build' : undefined);

  const footerContent = (() => {
    if (resolvedActionHint) {
      return <ActionHint kind={resolvedActionHint} />;
    }

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
        >
          Build in Drawing Phase
        </p>
      );
    }

    if (eligibility.state === 'NEED_COMPONENTS') {
      return (
        <>
          <p
            className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
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
        >
          Not enough lines
        </p>
      );
    }

    if (eligibility.state === 'MAX_LIMIT') {
      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
        >
          Maximum limit reached
        </p>
      );
    }

    if (eligibility.state === 'RULE_RESTRICTED') {
      return (
        <p
          className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px]"
        >
          Foreign basic ships cannot be built
        </p>
      );
    }

    return null;
  })();

  if (!footerContent && !challengeCondition) {
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
      <div className="flex w-full items-center gap-[12px]">
        {footerContent ? (
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[12px]">
            {footerContent}
          </div>
        ) : null}
        {challengeCondition ? <ChallengeRequirement condition={challengeCondition} /> : null}
      </div>
    </>
  );
}

function PowerText({ text }: { text: string }) {
  return (
    <p
      className="font-normal leading-[20px] text-[16px] text-left text-white whitespace-pre-wrap"
    >
      {text}
    </p>
  );
}

/**
 * Main hover card component
 */
export function ShipHoverCard({
  shipId,
  anchorRect,
  eligibility,
  actionHint,
  motionState,
  showCost = true,
  headingValue,
  showPhaseLabel = true,
  catalogueChallengeIndicator = null,
}: ShipHoverCardProps) {
  const model = getShipCardModel(shipId);
  const challengeCondition = catalogueChallengeIndicator?.shipDefId === shipId
    ? catalogueChallengeIndicator.condition
    : null;
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
        className="relative w-[320px]"
        style={{
          transform: cardTransform,
        }}
      >
        <HoverPanelFrame
          placement={placement}
          motionDirection="top"
          motionState={motionState}
          className="content-stretch flex w-full flex-col items-start gap-[12px] px-[20px] pb-[20px] pt-[16px]"
        >
      
        {/* Top Section: Cost + Name + Phase */}
        <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full">
          {/* Cost + Name */}
          <div className="content-stretch flex gap-[6px] items-center leading-[normal] relative shrink-0 text-[20px] text-nowrap text-white w-full">
            {showCost ? (
              <p
                className="font-black relative shrink-0"
              >
                {model.cost}
              </p>
            ) : null}
            <p
              className="font-bold relative shrink-0"
            >
              {model.name}
            </p>
            {headingValue ? (
              <div className="ml-auto flex shrink-0 items-center gap-[6px]">
                {headingValue.label ? (
                  <span
                    className="font-normal text-[13px] text-white"
                  >
                    {headingValue.label}
                  </span>
                ) : null}
                {headingValue.healing !== undefined ? (
                  <span
                    className="font-black text-[20px] text-[var(--shapeships-pastel-green)]"
                  >
                    {headingValue.healing}
                  </span>
                ) : null}
                {headingValue.damage !== undefined ? (
                  <span
                    className="font-black text-[20px] text-[var(--shapeships-pastel-red)]"
                  >
                    {headingValue.damage}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          
          {(showPhaseLabel && model.phaseLabel) || model.powerTagLabels.length > 0 ? (
            <div className="flex w-full flex-col items-start gap-[4px]">
              {/* Phase Label */}
              {showPhaseLabel && model.phaseLabel ? (
                <p
                  className="font-normal leading-[15px] relative shrink-0 text-[var(--shapeships-grey-20)] text-[13px] w-full"
                >
                  {model.phaseLabel}
                </p>
              ) : null}
              <ShipPowerTagBadgeRow labels={model.powerTagLabels} />
            </div>
          ) : null}
        </div>

        {/* Joining Lines */}
        {model.joiningLines && (
          <p
            className="font-medium leading-[12px] relative shrink-0 text-[var(--shapeships-grey-50)] text-[15px] text-nowrap"
          >
            <span className="font-bold">
              {model.joiningLines}
            </span>
            <span className="font-normal">
              {' joining lines'}
            </span>
          </p>
        )}
        
        {/* Powers */}
        {model.powers.length > 0 && (
          <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
            {model.powers.map((power, index) => (
              <ShipPowerRow key={index} iconKind={power.iconKind}>
                <PowerText text={power.text} />
              </ShipPowerRow>
            ))}
          </div>
        )}
        
        {/* Italic Notes */}
        {model.italicNotes && (
          <div className="content-stretch flex items-center relative shrink-0 w-full">
            <p
              className="basis-0 font-normal grow italic leading-[17px] min-h-px min-w-px relative shrink-0 text-[13px] text-white"
            >
              {model.italicNotes}
            </p>
          </div>
        )}
        
        {/* Eligibility Footer */}
        <EligibilityFooter
          eligibility={eligibility}
          componentShipIds={model.componentShipIds}
          actionHint={actionHint}
          challengeCondition={challengeCondition}
        />
        </HoverPanelFrame>
      </div>
    </div>
  );
  
  return ReactDOM.createPortal(cardContent, portalTarget);
}
