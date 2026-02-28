/**
 * ShipChoicesPanel - Layout template for ship choice action panels (UI only)
 * 
 * Renders:
 * - One or more ship groups (horizontally stacked)
 * - Each group has a centered heading + ShipChoiceGroup instances
 * - ShipChoiceGroup instances are centered and wrap naturally
 * - Optional OpponentAlsoHasCharges callout on the far right (Prompt 3B)
 * 
 * ARCHITECTURAL NOTES:
 * - UI pass only (no server calls, no registry, no rule logic)
 * - Uses ShipChoiceGroup primitive from Prompt 2
 * - Uses OpponentAlsoHasCharges primitive from Prompt 3B
 * - Data-driven via props (no hardcoded groups)
 */

import type { ShipChoicesPanelGroup, ShipChoiceGroupSpec } from '../../../types/ShipChoiceTypes';
import { ShipChoiceGroup } from './ShipChoiceGroup';
import { OpponentAlsoHasCharges } from './primitives/OpponentAlsoHasCharges';

// ============================================================================
// TYPES
// ============================================================================

interface ShipChoicesPanelProps {
  groups: ShipChoicesPanelGroup[];

  className?: string;
  
  showOpponentAlsoHasCharges?: boolean;
  opponentAlsoHasChargesHeading?: string;
  opponentAlsoHasChargesLines?: string[];

  selectedChoiceIdBySourceInstanceId?: Record<string, string>;
  onSelectChoiceForInstance?: (sourceInstanceId: string, choiceId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShipChoicesPanel({
  groups,
  className,
  showOpponentAlsoHasCharges = false,
  opponentAlsoHasChargesHeading,
  opponentAlsoHasChargesLines,
  selectedChoiceIdBySourceInstanceId,
  onSelectChoiceForInstance,
}: ShipChoicesPanelProps) {
  // ============================================================================
  // LAYOUT: TWO MODES
  // ============================================================================
  
  // Mode 1: Without callout (original centered layout)
  if (!showOpponentAlsoHasCharges) {
    return (
      <div
        className={`content-stretch flex gap-[40px] items-start justify-center ${className ?? ''}`}
        data-name="Ship Choices Panel"
      >
        {groups.map((group, groupIndex) => (
          <ShipGroupRenderer 
            key={groupIndex} 
            group={group}
            selectedChoiceIdBySourceInstanceId={selectedChoiceIdBySourceInstanceId}
            onSelectChoiceForInstance={onSelectChoiceForInstance}
          />
        ))}
      </div>
    );
  }
  
  // Mode 2: With callout (two-column layout)
  return (
    <div
      className={`content-stretch flex gap-[40px] items-start ${className ?? ''}`}
      data-name="Ship Choices Panel (with callout)"
    >
      {/* Left: Ship Groups Content (flex-1 allows shrinking) */}
      <div className="flex-initial flex gap-[36px] items-start justify-center">
        {groups.map((group, groupIndex) => (
          <ShipGroupRenderer 
            key={groupIndex} 
            group={group}
            selectedChoiceIdBySourceInstanceId={selectedChoiceIdBySourceInstanceId}
            onSelectChoiceForInstance={onSelectChoiceForInstance}
          />
        ))}
      </div>

      {/* Right: OpponentAlsoHasCharges Callout (shrink-0, 20px right padding) */}
      <div className="shrink-0 pr-[20px]">
        <OpponentAlsoHasCharges
          heading={opponentAlsoHasChargesHeading}
          lines={opponentAlsoHasChargesLines}
        />
      </div>
    </div>
  );
}

// ============================================================================
// SHIP GROUP RENDERER (with optional two-column layout for groupHelpText)
// ============================================================================

interface ShipGroupRendererProps {
  group: ShipChoicesPanelGroup;
  selectedChoiceIdBySourceInstanceId?: Record<string, string>;
  onSelectChoiceForInstance?: (sourceInstanceId: string, choiceId: string) => void;
}

function ShipGroupRenderer({ group, selectedChoiceIdBySourceInstanceId, onSelectChoiceForInstance }: ShipGroupRendererProps) {
  // If no groupHelpText, use standard single-column layout
  if (!group.groupHelpText) {
    return (
      <div
        className="inline-flex flex flex-col gap-[20px] items-center relative"
        data-name="Ship Group"
      >
        {/* Group Heading */}
        <h3 className="text-[18px] font-bold text-center text-white">
          {group.heading}
        </h3>

        {/* ShipChoiceGroup Instances (centered, wrapping) */}
        <div className="flex flex-wrap justify-center gap-[36px]">
          {group.ships.map((ship, shipIndex) => {
            const selectedChoiceId = ship.sourceInstanceId 
              ? selectedChoiceIdBySourceInstanceId?.[ship.sourceInstanceId]
              : undefined;
            
            const handleSelect = ship.sourceInstanceId && onSelectChoiceForInstance
              ? (choiceId: string) => onSelectChoiceForInstance(ship.sourceInstanceId!, choiceId)
              : undefined;

            // Disable buttons when not eligible (use availableChoiceIds)
            const buttonsWithDisabled = ship.availableChoiceIds
              ? ship.buttons.map(b => ({
                  ...b,
                  disabled: b.choiceId ? !ship.availableChoiceIds!.includes(b.choiceId) : b.disabled,
                }))
              : ship.buttons;

            return (
              <ShipChoiceGroup
                key={shipIndex}
                shipDefId={ship.shipDefId}
                buttons={buttonsWithDisabled}
                graphicContext={ship.currentCharges != null ? 'live' : undefined}
                explicitCharges={ship.explicitCharges}
                currentCharges={ship.currentCharges}
                selectedChoiceId={selectedChoiceId}
                onSelectChoiceId={handleSelect}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // If groupHelpText is present, use two-column layout
  return (
    <div
      className="flex flex-col gap-[32px] items-start relative shrink-0"
      data-name="Ship Group (with help)"
    >
      {/* Group Heading */}
      <h3 className="text-[18px] font-bold text-center text-white w-full">
        {group.heading}
      </h3>

      {/* Two-Column Layout: Ship Choices | Help Text */}
      <div className="flex gap-[40px] items-center relative shrink-0">
        {/* Left: Ship Choices (centered, wrapping) */}
        <div className="flex flex-wrap justify-center gap-[36px]">
          {group.ships.map((ship, shipIndex) => {
            const selectedChoiceId = ship.sourceInstanceId 
              ? selectedChoiceIdBySourceInstanceId?.[ship.sourceInstanceId]
              : undefined;
            
            const handleSelect = ship.sourceInstanceId && onSelectChoiceForInstance
              ? (choiceId: string) => onSelectChoiceForInstance(ship.sourceInstanceId!, choiceId)
              : undefined;

            // Disable buttons when not eligible (use availableChoiceIds)
            const buttonsWithDisabled = ship.availableChoiceIds
              ? ship.buttons.map(b => ({
                  ...b,
                  disabled: b.choiceId ? !ship.availableChoiceIds!.includes(b.choiceId) : b.disabled,
                }))
              : ship.buttons;

            return (
              <ShipChoiceGroup
                key={shipIndex}
                shipDefId={ship.shipDefId}
                buttons={buttonsWithDisabled}
                graphicContext={ship.currentCharges != null ? 'live' : undefined}
                explicitCharges={ship.explicitCharges}
                currentCharges={ship.currentCharges}
                selectedChoiceId={selectedChoiceId}
                onSelectChoiceId={handleSelect}
              />
            );
          })}
        </div>

        {/* Right: Group Help Text (grey, 18px, 270px width) */}
        <div
          className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[var(--shapeships-grey-50)] text-[18px] w-[270px] whitespace-pre-wrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {group.groupHelpText}
        </div>
      </div>
    </div>
  );
}