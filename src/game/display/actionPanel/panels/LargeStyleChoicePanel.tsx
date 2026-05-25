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

  layout?: 'desktop' | 'mobile';

  className?: string;
}

function getMobileGraphicFrameClasses(shipDefId: ShipDefId) {
  if (shipDefId === 'SAC') {
    return {
      frame: 'h-[61px] w-[61px]',
      inner: 'scale-[0.55]',
    };
  }

  if (shipDefId === 'DOM') {
    return {
      frame: 'h-[112px] w-[166px]',
      inner: 'scale-[0.55]',
    };
  }

  return {
    frame: 'h-[132px] w-[192px]',
    inner: 'scale-[0.55]',
  };
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
  layout = 'desktop',
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

  if (layout === 'mobile') {
    const mobileGraphicFrameClasses = getMobileGraphicFrameClasses(shipDefId);

    return (
      <div
        className={`flex w-full min-w-0 flex-col items-center gap-[10px] text-center ${className ?? ''}`}
        data-name="Large Style Choice Panel"
      >
        <p
          className="relative w-full max-w-[330px] font-['Roboto',sans-serif] font-bold text-white text-[14px] leading-[16px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {title}
        </p>

        {instruction ? (
          <p
            className="relative w-full max-w-[330px] shrink-0 font-['Roboto',sans-serif] font-bold text-[var(--shapeships-pastel-red)] text-[14px] leading-[16px] whitespace-pre-wrap"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {instruction}
          </p>
        ) : null}

        <div
          className={`relative flex shrink-0 items-center justify-center overflow-visible ${mobileGraphicFrameClasses.frame}`}
          data-name="Ship Graphic"
        >
          <div className={`origin-center ${mobileGraphicFrameClasses.inner}`}>
            {ShipGraphic ? (
              <ShipGraphic />
            ) : (
              <div className="flex items-center justify-center h-[240px] w-[349px] text-white text-[18px]">
                {shipDefId}
              </div>
            )}
          </div>
        </div>

        {helpText ? (
          <p
            className="w-full max-w-[330px] shrink-0 font-['Roboto',sans-serif] font-normal text-[var(--shapeships-grey-50)] text-[14px] leading-[16px] whitespace-pre-wrap"
            style={{ fontVariationSettings: "'wdth' 100" }}
            data-name="Help Text"
          >
            {helpText}
          </p>
        ) : null}
      </div>
    );
  }

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
        className="content-stretch flex flex-col font-['Roboto',sans-serif] font-bold gap-[16px] items-start leading-[normal] relative shrink-0 text-[18px] w-[300px]"
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
          className="font-['Roboto',sans-serif] font-normal leading-[normal] relative shrink-0 text-[var(--shapeships-grey-50)] text-[18px] w-[270px] whitespace-pre-wrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
          data-name="Help Text"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}
