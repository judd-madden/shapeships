/**
 * FrigateDrawingPanel - Special layout for Human Frigate trigger number selection
 * 
 * Renders:
 * - Top instruction text (pluralized based on count)
 * - Frigate selector blocks (one per Frigate drawn this turn)
 * - Bottom explanatory text
 * 
 * Each selector block contains:
 * - Frigate graphic (from ShipDefinitionsUI + resolveShipGraphic)
 * - 6 number buttons (1-6) using ActionButton
 * - Local selection state (defaults to 1)
 * 
 * ARCHITECTURAL NOTES:
 * - UI pass only (no server calls, no intent wiring)
 * - Selection state is local only (not yet wired to intents)
 * - This panel only appears when Frigates are drawn (game state routing)
 * - Trigger number is chosen ONCE when Frigate is first drawn (permanent choice)
 */

import type React from 'react';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import { ActionButton } from '../../../../components/ui/primitives/buttons/ActionButton';

// ============================================================================
// TYPES
// ============================================================================

interface FrigateDrawingPanelProps {
  /**
   * Number of Frigates requiring trigger selection this turn.
   * This should come from the build preview (how many FRI are being built this turn),
   * not from the existing fleet count.
   */
  frigateCount: number;

  /**
   * Controlled selection state: index corresponds to the Nth Frigate built this turn.
   * Must be length >= frigateCount (extra entries ignored).
   */
  selectedTriggers: number[];

  /**
   * Called when user selects a trigger for a specific Frigate index.
   */
  onSelectTrigger: (frigateIndex: number, triggerNumber: number) => void;

  layout?: 'desktop' | 'mobile';

  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FrigateDrawingPanel({
  frigateCount,
  selectedTriggers,
  onSelectTrigger,
  layout = 'desktop',
  className,
}: FrigateDrawingPanelProps) {
  const isMobile = layout === 'mobile';

  // ============================================================================
  // LOCAL STATE (UI-only, not yet wired to intents)
  // ============================================================================

  // Track selected trigger number for each Frigate (defaults to 1)
  // ============================================================================
  // RESOLVE FRIGATE GRAPHIC
  // ============================================================================

  const frigateDef = getShipDefinitionUI('FRI');
  const frigateGraphic = frigateDef
    ? resolveShipGraphic(frigateDef, { context: 'default' })
    : undefined;

  const FrigateGraphic = frigateGraphic?.component;

  // ============================================================================
  // EMPTY STATE
  // ============================================================================

  if (frigateCount === 0) {
    return (
      <div className="size-full flex flex-col items-center justify-center">
        <p className="text-[var(--shapeships-grey-50)] text-[18px]">
          No actions available.
        </p>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  // Pluralization for instruction text
  const instructionText =
    frigateCount === 1
      ? 'Choose a permanent trigger number for your Frigate.'
      : 'Choose a permanent trigger number for your Frigates.';

  const explanationText =
    'When the dice match this number, deal 6 damage (including on this turn).';

  return (
    <div
      className={
        isMobile
          ? `content-stretch flex w-full min-w-0 flex-col gap-[14px] items-center py-[4px] ${className ?? ''}`
          : `content-stretch flex flex-col gap-[32px] items-center justify-center py-[20px] size-full ${className ?? ''}`
      }
      data-name="Frigate Drawing Panel"
    >
      {/* Instruction Text (Top) */}
      <h3
        className={`font-['Roboto',sans-serif] font-bold leading-[normal] relative shrink-0 text-white text-center ${isMobile ? 'w-full text-[15px]' : 'text-[18px]'}`}
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {instructionText}
      </h3>

      {/* Center Content: Frigate Selector Blocks */}
      <div
        className={
          isMobile
            ? 'content-center flex w-full min-w-0 flex-col gap-[32px] items-center shrink-0'
            : 'content-center flex flex-wrap gap-[36px] items-center justify-center shrink-0 w-full'
        }
        data-name="Frigate Selector Blocks"
      >
        {Array.from({ length: frigateCount }, (_, index) => (
          <FrigateSelectorBlock
            key={index}
            frigateIndex={index}
            selectedTrigger={selectedTriggers[index] ?? 1}
            onTriggerSelect={(triggerNumber) => onSelectTrigger(index, triggerNumber)}
            FrigateGraphic={FrigateGraphic}
            layout={layout}
          />
        ))}
      </div>

      {/* Bottom Explanatory Text */}
      <p
        className={`font-['Roboto',sans-serif] font-normal leading-[normal] shrink-0 text-center text-white w-full whitespace-pre-wrap ${isMobile ? 'text-[13px]' : 'text-[16px]'}`}
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {explanationText}
      </p>
    </div>
  );
}

// ============================================================================
// FRIGATE SELECTOR BLOCK (ship graphic + 6 number buttons)
// ============================================================================

interface FrigateSelectorBlockProps {
  frigateIndex: number;
  selectedTrigger: number;
  onTriggerSelect: (triggerNumber: number) => void;
  FrigateGraphic: React.ComponentType | undefined;
  layout?: 'desktop' | 'mobile';
}

function FrigateSelectorBlock({
  selectedTrigger,
  onTriggerSelect,
  FrigateGraphic,
  layout = 'desktop',
}: FrigateSelectorBlockProps) {
  const isMobile = layout === 'mobile';
  const triggerNumbers = [1, 2, 3, 4, 5, 6];

  return (
    <div
      className={
        isMobile
          ? 'content-stretch mx-auto flex w-full max-w-[336px] gap-[12px] items-start shrink-0'
          : 'content-stretch flex gap-[16px] items-center shrink-0'
      }
      data-name="Frigate Selector Block"
    >
      {/* Frigate Graphic */}
      <div
        className={isMobile ? 'relative h-[70px] w-[42px] shrink-0 overflow-visible' : 'shrink-0'}
        data-name="Frigate Graphic"
      >
        <div className={isMobile ? 'origin-top-left scale-[0.78]' : ''}>
          {FrigateGraphic ? (
            <FrigateGraphic />
          ) : (
            // Fallback: simple white text label
            <div className={isMobile ? 'flex h-[70px] w-[42px] items-center justify-center text-white text-[13px]' : 'flex items-center justify-center h-[88px] w-[52px] text-white text-[14px]'}>
              FRI
            </div>
          )}
        </div>
      </div>

      {/* Number Buttons (1-6) */}
      <div
        className={
          isMobile
            ? 'content-stretch flex min-w-0 flex-1 gap-[4px] shrink-0'
            : 'content-stretch flex gap-[8px] items-center shrink-0'
        }
        data-name="Trigger Number Buttons"
      >
        {triggerNumbers.map((num) => (
          <ActionButton
            key={num}
            label={String(num)}
            selected={selectedTrigger === num}
            backgroundColor={selectedTrigger === num ? 'var(--shapeships-yellow)' : 'var(--shapeships-grey-20)'}
            textColor="black"
            onClick={() => onTriggerSelect(num)}
            density={isMobile ? 'mobile' : 'desktop'}
            className={isMobile ? '!w-auto flex-1 min-w-0' : 'w-[50px]'}
          />
        ))}
      </div>
    </div>
  );
}
