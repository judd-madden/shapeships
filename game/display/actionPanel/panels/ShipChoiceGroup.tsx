/**
 * ShipChoiceGroup - Reusable ship choice primitive (UI only)
 * 
 * Renders:
 * - Ship graphic (left) via getShipDefinitionUI + resolveShipGraphic
 * - Vertical button stack (right) using ActionButton/ActionButtonSmall
 * - Optional instructions area (bottom) with border when visible
 * 
 * ARCHITECTURAL NOTES:
 * - UI pass only (no server calls, no intents, no rule evaluation)
 * - Uses existing ship graphics resolver (charge-ready language)
 * - requiresTargeting is declarative metadata only (no behavior yet)
 * - Instructions visibility driven by showsInstructions + instructionText
 */

import { useState } from 'react';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import type { GraphicContext } from '../../graphics/resolveShipGraphic';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import { ActionButton } from '../../../../components/ui/primitives/buttons/ActionButton';
import { ActionButtonSmall } from '../../../../components/ui/primitives/buttons/ActionButtonSmall';
import type { ShipChoiceButtonSpec, ShipChoiceButtonSize } from '../../../types/ShipChoiceTypes';

// ============================================================================
// TYPES
// ============================================================================

interface ShipChoiceGroupProps {
  shipDefId: ShipDefId;

  /**
   * Graphic resolution context.
   * For action panels we will typically treat this like 'default' for now.
   * (Later we may add an explicit 'action' context, but do not change resolver in this prompt.)
   */
  graphicContext?: GraphicContext; // default 'default'

  /**
   * Optional charge hints for future wiring.
   * - explicitCharges: locks the displayed graphic to charges_N (if available)
   * - currentCharges: used only by resolver when context === 'live'
   *
   * For this UI pass, callers will usually NOT provide these.
   */
  explicitCharges?: number;
  currentCharges?: number | null;

  // Buttons, rendered in order, first is selected by default
  buttons: ShipChoiceButtonSpec[];

  className?: string;
}

// ============================================================================
// HELPER: SHIP COLOUR TO CSS VAR
// ============================================================================

/**
 * Convert ship colour name to CSS var string.
 * Example: "Bright Orange" → "var(--shapeships-bright-orange)"
 */
function toCssVarFromColourName(colour?: string): string | undefined {
  if (!colour) return undefined;
  const slug = colour.trim().toLowerCase().replace(/\s+/g, '-');
  return `var(--shapeships-${slug})`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShipChoiceGroup({
  shipDefId,
  graphicContext = 'default',
  explicitCharges,
  currentCharges,
  buttons,
  className,
}: ShipChoiceGroupProps) {
  // ============================================================================
  // STATE: SELECTED BUTTON INDEX
  // ============================================================================
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ============================================================================
  // SHIP GRAPHIC RESOLUTION
  // ============================================================================
  
  const def = getShipDefinitionUI(shipDefId);
  
  // Resolve ship graphic using existing resolver system
  const graphic = def
    ? resolveShipGraphic(def, {
        context: graphicContext,
        explicitCharges,
        currentCharges,
      })
    : null;
  
  const ShipGraphic = graphic?.component;
  
  // Get ship color for selected button background
  const selectedBackgroundColor = toCssVarFromColourName(def?.colour);

  // ============================================================================
  // INSTRUCTIONS VISIBILITY
  // ============================================================================
  
  const selectedButton = buttons[selectedIndex];
  const showInstructions =
    selectedButton?.showsInstructions === true &&
    typeof selectedButton?.instructionText === 'string' &&
    selectedButton.instructionText.trim().length > 0;

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className={['inline-flex flex flex-col items-start', className].filter(Boolean).join(' ')} data-name="Ship Choice Group">
      {/* Top Block: Ship Graphic + Buttons */}
      <div className="inline-flex flex gap-[16px] items-start relative shrink-0">
        {/* Ship Graphic (Left) */}
        <div className="content-stretch flex items-center pt-[4px] relative shrink-0">
          {ShipGraphic ? (
            <ShipGraphic />
          ) : (
            // Fallback: show shipDefId as text
            <div className="text-white text-sm font-bold">
              {shipDefId}
            </div>
          )}
        </div>

        {/* Buttons (Right) */}
        <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-[250px]">
          {buttons.map((spec, index) => {
            const isSelected = selectedIndex === index;
            const isDisabled = spec.disabled ?? false;
            const backgroundColor = isSelected ? selectedBackgroundColor : undefined;

            if (spec.size === 'large') {
              return (
                <ActionButton
                  key={index}
                  label={spec.label}
                  detail={spec.detail}
                  selected={isSelected}
                  disabled={isDisabled}
                  backgroundColor={backgroundColor}
                  onClick={() => setSelectedIndex(index)}
                />
              );
            } else {
              return (
                <ActionButtonSmall
                  key={index}
                  label={spec.label}
                  selected={isSelected}
                  disabled={isDisabled}
                  backgroundColor={backgroundColor}
                  onClick={() => setSelectedIndex(index)}
                />
              );
            }
          })}
        </div>
      </div>

      {/* Instructions Area (Bottom) - Only when visible */}
      {showInstructions && (
        <div className="relative self-stretch flex items-center justify-center mt-[16px] max-w-[380px]">
          {/* Top border (Grey 70) */}
          <div
            aria-hidden="true"
            className="border-[var(--shapeships-grey-70)] border-solid border-t inset-0 pointer-events-none"
          />
          
          {/* Instruction text */}
          <p
            className="font-['Roboto',sans-serif] font-bold leading-[normal] relative text-[var(--shapeships-pastel-red)] text-[18px] text-center whitespace-pre-wrap break-words"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {selectedButton.instructionText}
          </p>
        </div>
      )}
    </div>
  );
}