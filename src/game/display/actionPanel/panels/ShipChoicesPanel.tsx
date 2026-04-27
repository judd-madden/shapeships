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
import type { CentaurChargeSubTabId } from '../../../client/gameSession/types';
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
  centaurChargeTabs?: {
    activeTab: CentaurChargeSubTabId;
    availableTabs: CentaurChargeSubTabId[];
  };
  onSelectCentaurChargeSubTab?: (tabId: CentaurChargeSubTabId) => void;
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
  centaurChargeTabs,
  onSelectCentaurChargeSubTab,
}: ShipChoicesPanelProps) {
  const hasCentaurChargeTabs =
    Array.isArray(centaurChargeTabs?.availableTabs) &&
    centaurChargeTabs.availableTabs.length > 1;

  const content = !showOpponentAlsoHasCharges ? (
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
  ) : (
    <div
      className={`content-stretch flex gap-[40px] items-start ${className ?? ''}`}
      data-name="Ship Choices Panel (with callout)"
    >
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

      <div className="shrink-0 pr-[20px]">
        <OpponentAlsoHasCharges
          heading={opponentAlsoHasChargesHeading}
          lines={opponentAlsoHasChargesLines}
        />
      </div>
    </div>
  );

  // ============================================================================
  // LAYOUT
  // ============================================================================

  return (
    <div className="flex flex-col gap-[12px] items-center">
      {hasCentaurChargeTabs ? (
        <div className="inline-flex items-center gap-[12px] rounded-[10px] bg-[#212121] p-[3px]">
          {centaurChargeTabs!.availableTabs.map((tabId) => {
            const selected = centaurChargeTabs!.activeTab === tabId;
            const label = tabId === 'charges' ? 'Charges' : 'Ship of Equality';

            return (
              <button
                key={tabId}
                type="button"
                className="min-w-[132px] rounded-[8px] px-[20px] py-[10px] disabled:opacity-50"
                style={{ backgroundColor: selected ? '#555555' : '#212121' }}
                onClick={() => onSelectCentaurChargeSubTab?.(tabId)}
              >
                <p
                  className="font-['Roboto'] font-bold leading-[normal] text-[18px] text-nowrap text-white"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {label}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      <div>
        {content}
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
      className="flex flex-col gap-[16px] items-start relative shrink-0"
      data-name="Ship Group (with help)"
    >
      {/* Group Heading */}
      <h3 className="text-[18px] font-bold text-center text-white w-full">
        {group.heading}
      </h3>

      {/* Two-Column Layout: Ship Choices | Help Text */}
      <div className="flex gap-[40px] items-start relative shrink-0">
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

        {/* Right: Group Help Text (grey, 16px, 270px width) */}
        <div
          className="font-['Roboto',sans-serif] font-normal leading-[normal] relative shrink-0 text-[var(--shapeships-grey-50)] text-[16px] w-[270px] whitespace-pre-wrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {group.groupHelpText}
        </div>
      </div>
    </div>
  );
}
