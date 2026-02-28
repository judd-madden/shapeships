/**
 * LargeStyleChoicePanel - Template for "large-style choices" action panels (UI only)
 * 
 * Renders:
 * - Large ship graphic (left)
 * - Title + instruction text (center)
 * - Help text (right)
 * 
 * Used for panels like Ark of Domination where the ship graphic is very large
 * and no action buttons are present (purely informational + instruction).
 * 
 * ARCHITECTURAL NOTES:
 * - UI pass only (no server calls, no registry wiring, no phase logic)
 * - Uses ShipDefinitionsUI + resolveShipGraphic for ship graphics
 * - No action buttons (purely informational)
 * - Data-driven via props
 */

import type { ShipDefId } from '../../../types/ShipTypes.engine';
import type { GraphicContext } from '../../graphics/resolveShipGraphic';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';

// ============================================================================
// TYPES
// ============================================================================

interface LargeStyleChoicePanelProps {
  shipDefId: ShipDefId;

  /**
   * Title shown in white (e.g. "Ark of Domination")
   */
  title: string;

  /**
   * Instruction shown in pastel red (required targeting / selection instruction)
   */
  instruction: string;

  /**
   * Help text shown in Grey 50 (right side)
   */
  helpText?: string;

  /**
   * Graphic resolution context and optional charge hints (future-ready).
   * For this UI pass, context defaults to 'default' and charge hints are typically omitted.
   */
  graphicContext?: GraphicContext; // default 'default'
  explicitCharges?: number;
  currentCharges?: number | null;

  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LargeStyleChoicePanel({
  shipDefId,
  title,
  instruction,
  helpText,
  graphicContext = 'default',
  explicitCharges,
  currentCharges,
  className,
}: LargeStyleChoicePanelProps) {
  // ============================================================================
  // RESOLVE SHIP GRAPHIC
  // ============================================================================

  const def = getShipDefinitionUI(shipDefId);
  const graphic = def
    ? resolveShipGraphic(def, {
        context: graphicContext,
        explicitCharges,
        currentCharges,
      })
    : undefined;

  const ShipGraphic = graphic?.component;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={`content-stretch flex gap-[32px] items-center justify-center relative size-full ${className ?? ''}`}
      data-name="Large Style Choice Panel"
    >
      {/* Left Column: Large Ship Graphic */}
      <div className="shrink-0" data-name="Ship Graphic">
        {ShipGraphic ? (
          <ShipGraphic />
        ) : (
          // Fallback: simple white text label with shipDefId
          <div className="flex items-center justify-center h-[240px] w-[349px] text-white text-[18px]">
            {shipDefId}
          </div>
        )}
      </div>

      {/* Center Column: Title + Instruction */}
      <div
        className="content-stretch flex flex-col font-['Roboto:Bold',sans-serif] font-bold gap-[16px] items-start leading-[normal] relative shrink-0 text-[18px] w-[300px]"
        data-name="Title and Instruction"
      >
        {/* Title (White, Centered) */}
        <p
          className="relative text-white w-full"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {title}
        </p>

        {/* Instruction (Pastel Red) */}
        <p
          className="min-w-full relative shrink-0 text-[var(--shapeships-pastel-red)] w-[min-content] whitespace-pre-wrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {instruction}
        </p>
      </div>

      {/* Right Column: Help Text (Grey 50) */}
      {helpText && (
        <p
          className="font-['Roboto:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[var(--shapeships-grey-50)] text-[18px] w-[270px] whitespace-pre-wrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
          data-name="Help Text"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}
