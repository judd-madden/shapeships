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

const DEFAULT_OPPONENT_CHARGES_HEADING = 'Your opponent also has charges available.';

const DEFAULT_OPPONENT_CHARGES_LINES = [
  'If you use any charges, they can respond.',
  'If they use any charges, you can respond.',
  'If you both hold all charges, play proceeds.',
];

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
  layout?: 'desktop' | 'mobile';
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
  layout = 'desktop',
}: ShipChoicesPanelProps) {
  const isMobile = layout === 'mobile';
  const hasCentaurChargeTabs =
    Array.isArray(centaurChargeTabs?.availableTabs) &&
    centaurChargeTabs.availableTabs.length > 1;

  const content = isMobile ? (
    <div
      className={`mx-auto flex w-full max-w-[340px] flex-col items-stretch gap-[18px] ${className ?? ''}`}
      data-name="Ship Choices Panel Mobile"
    >
      {groups.map((group, groupIndex) => (
        <ShipGroupRenderer
          key={groupIndex}
          group={group}
          layout="mobile"
          selectedChoiceIdBySourceInstanceId={selectedChoiceIdBySourceInstanceId}
          onSelectChoiceForInstance={onSelectChoiceForInstance}
        />
      ))}

      {showOpponentAlsoHasCharges ? (
        <MobileOpponentAlsoHasChargesNote
          heading={opponentAlsoHasChargesHeading}
          lines={opponentAlsoHasChargesLines}
        />
      ) : null}
    </div>
  ) : !showOpponentAlsoHasCharges ? (
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
    <div className={isMobile ? 'flex w-full flex-col gap-[12px] items-center' : 'flex flex-col gap-[12px] items-center'}>
      {hasCentaurChargeTabs ? (
        <div
          className={
            isMobile
              ? 'inline-flex max-w-full items-center gap-[8px] rounded-[10px] bg-[#212121] p-[3px]'
              : 'inline-flex items-center gap-[12px] rounded-[10px] bg-[#212121] p-[3px]'
          }
        >
          {centaurChargeTabs!.availableTabs.map((tabId) => {
            const selected = centaurChargeTabs!.activeTab === tabId;
            const label = tabId === 'charges' ? 'Charges' : 'Ship of Equality';

            return (
              <button
                key={tabId}
                type="button"
                className={
                  isMobile
                    ? 'min-w-[104px] rounded-[8px] px-[12px] py-[8px] disabled:opacity-50'
                    : 'min-w-[132px] rounded-[8px] px-[20px] py-[10px] disabled:opacity-50'
                }
                style={{ backgroundColor: selected ? '#555555' : '#212121' }}
                onClick={() => onSelectCentaurChargeSubTab?.(tabId)}
              >
                <p
                  className={`font-['Roboto'] font-bold leading-[normal] text-nowrap text-white ${isMobile ? 'text-[13px]' : 'text-[18px]'}`}
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {label}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={isMobile ? 'w-full' : ''}>
        {content}
      </div>
    </div>
  );
}

interface MobileOpponentAlsoHasChargesNoteProps {
  heading?: string;
  lines?: string[];
}

function MobileOpponentAlsoHasChargesNote({
  heading = DEFAULT_OPPONENT_CHARGES_HEADING,
  lines = DEFAULT_OPPONENT_CHARGES_LINES,
}: MobileOpponentAlsoHasChargesNoteProps) {
  return (
    <div className="w-full rounded-[8px] bg-[#212121] px-[12px] py-[10px] text-center">
      <p
        className="font-['Roboto',sans-serif] font-bold leading-[normal] text-[14px] text-white"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {heading}
      </p>
      <div
        className="mt-[8px] font-['Roboto',sans-serif] font-normal leading-[normal] text-[13px] text-[var(--shapeships-grey-50)]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {lines.map((line, index) => (
          <p key={index} className={index < lines.length - 1 ? 'mb-[6px]' : ''}>
            {line}
          </p>
        ))}
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
  layout?: 'desktop' | 'mobile';
}

function ShipGroupRenderer({
  group,
  selectedChoiceIdBySourceInstanceId,
  onSelectChoiceForInstance,
  layout = 'desktop',
}: ShipGroupRendererProps) {
  const isMobile = layout === 'mobile';

  if (isMobile) {
    return (
      <div
        className="flex w-full min-w-0 flex-col gap-[12px] items-center relative"
        data-name={group.groupHelpText ? 'Ship Group Mobile (with help)' : 'Ship Group Mobile'}
      >
        {/* Group Heading */}
        <h3 className="w-full text-[15px] font-bold text-center text-white">
          {group.heading}
        </h3>

        {/* ShipChoiceGroup Instances */}
        <div className="flex w-full min-w-0 flex-col items-center gap-[32px]">
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
                layout="mobile"
              />
            );
          })}
        </div>

        {group.groupHelpText ? (
          <div
            className="w-full rounded-[8px] py-[12px] text-center font-['Roboto',sans-serif] font-normal leading-[normal] text-[var(--shapeships-grey-50)] text-[14px] whitespace-pre-wrap"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {group.groupHelpText}
          </div>
        ) : null}
      </div>
    );
  }

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
