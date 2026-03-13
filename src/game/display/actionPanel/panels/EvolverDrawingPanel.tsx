/**
 * EvolverDrawingPanel - Special layout for Xenite Evolver evolution choices
 * 
 * Renders:
 * - Top heading text (dynamic count of Evolvers)
 * - Evolver choice blocks (one per Evolver in fleet)
 * 
 * Each Evolver block contains:
 * - Left: Evolver graphic (EVO)
 * - Middle: 3 ship graphics (OXI, AST, XEN) stacked vertically
 * - Right: 3 choice buttons (Evolve Oxite, Evolve Asterite, Do not evolve)
 * 
 * GAME SEMANTICS:
 * - An Evolver does NOT evolve itself
 * - An Evolver allows an existing Xenite to evolve into Oxite or Asterite
 * - This panel appears only when evolution choices are available
 * 
 * ARCHITECTURAL NOTES:
 * - Presentation-only panel
 * - Selection state is owned by client runtime
 * - Uses existing ActionButton and ActionButtonSmall primitives
 */

import type { ComponentType } from 'react';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import { ActionButton } from '../../../../components/ui/primitives/buttons/ActionButton';
import { ActionButtonSmall } from '../../../../components/ui/primitives/buttons/ActionButtonSmall';
import type { EvolverChoiceId } from '../../../client/gameSession/types';

// ============================================================================
// TYPES
// ============================================================================

interface EvolverDrawingPanelProps {
  rows: Array<{
    rowId: string;
    choiceId: EvolverChoiceId;
  }>;
  onSelectChoice: (rowId: string, choiceId: EvolverChoiceId) => void;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EvolverDrawingPanel({
  rows,
  onSelectChoice,
  className,
}: EvolverDrawingPanelProps) {
  // ============================================================================
  // RESOLVE SHIP GRAPHICS
  // ============================================================================

  const evoDef = getShipDefinitionUI('EVO');
  const oxiDef = getShipDefinitionUI('OXI');
  const astDef = getShipDefinitionUI('AST');
  const xenDef = getShipDefinitionUI('XEN');

  const evoGraphic = evoDef ? resolveShipGraphic(evoDef, { context: 'default' }) : undefined;
  const oxiGraphic = oxiDef ? resolveShipGraphic(oxiDef, { context: 'default' }) : undefined;
  const astGraphic = astDef ? resolveShipGraphic(astDef, { context: 'default' }) : undefined;
  const xenGraphic = xenDef ? resolveShipGraphic(xenDef, { context: 'default' }) : undefined;

  const EvoGraphic = evoGraphic?.component;
  const OxiGraphic = oxiGraphic?.component;
  const AstGraphic = astGraphic?.component;
  const XenGraphic = xenGraphic?.component;

  // ============================================================================
  // EMPTY STATE
  // ============================================================================

  if (rows.length === 0) {
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

  // Dynamic heading with count
  const evolverCount = rows.length;
  const headingText = `${evolverCount} ${evolverCount === 1 ? 'Evolver' : 'Evolvers'} may evolve Xenites into Oxites (1 healing each turn) or Asterites (1 damage each turn).`;

  return (
    <div
      className={`content-stretch flex flex-col gap-[32px] items-center py-[20px] size-full ${className ?? ''}`}
      data-name="Evolver Drawing Panel"
    >
      {/* Heading Text (Top) */}
      <h3
        className="font-['Roboto',sans-serif] font-bold leading-[normal] relative shrink-0 text-white text-[18px] text-center w-full"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {headingText}
      </h3>

      {/* Center Content: Evolver Choice Blocks */}
      <div
        className="content-center flex flex-wrap gap-[36px] items-center justify-center shrink-0 w-full"
        data-name="Evolver Choice Blocks"
      >
        {rows.map((row) => (
          <EvolverChoiceBlock
            key={row.rowId}
            selectedChoice={row.choiceId}
            onChoiceSelect={(choice) => onSelectChoice(row.rowId, choice)}
            EvoGraphic={EvoGraphic}
            OxiGraphic={OxiGraphic}
            AstGraphic={AstGraphic}
            XenGraphic={XenGraphic}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EVOLVER CHOICE BLOCK (Evolver graphic + evolution graphics + buttons)
// ============================================================================

interface EvolverChoiceBlockProps {
  selectedChoice: EvolverChoiceId;
  onChoiceSelect: (choice: EvolverChoiceId) => void;
  EvoGraphic: ComponentType | undefined;
  OxiGraphic: ComponentType | undefined;
  AstGraphic: ComponentType | undefined;
  XenGraphic: ComponentType | undefined;
}

function EvolverChoiceBlock({
  selectedChoice,
  onChoiceSelect,
  EvoGraphic,
  OxiGraphic,
  AstGraphic,
  XenGraphic,
}: EvolverChoiceBlockProps) {
  return (
    <div
      className="content-stretch flex gap-[23px] items-start shrink-0"
      data-name="Evolver Choice Block"
    >
      {/* Left Column: Evolver Graphic */}
      <div className="content-stretch flex items-center pr-[8px] pt-[4px] shrink-0" data-name="Evolver Graphic">
        {EvoGraphic ? (
          <EvoGraphic />
        ) : (
          // Fallback: simple text label
          <div className="flex items-center justify-center h-[40px] w-[40px] text-white text-[14px]">
            EVO
          </div>
        )}
      </div>

      {/* Middle Column: Evolution Ship Graphics (OXI, AST, XEN) */}
      <div
        className="content-stretch flex flex-col gap-[8px] items-center shrink-0 w-[44px]"
        data-name="Evolution Graphics"
      >
        {/* Top group: Oxite and Asterite (with 16px gap between them) */}
        <div className="content-stretch flex flex-col gap-[16px] items-center pt-[3px] w-full">
          {/* Oxite Graphic */}
          <div className="shrink-0" data-name="Oxite">
            {OxiGraphic ? (
              <OxiGraphic />
            ) : (
              <div className="flex items-center justify-center h-[44px] w-[44px] text-white text-[12px]">
                OXI
              </div>
            )}
          </div>

          {/* Asterite Graphic */}
          <div className="shrink-0" data-name="Asterite">
            {AstGraphic ? (
              <AstGraphic />
            ) : (
              <div className="flex items-center justify-center h-[44px] w-[44px] text-white text-[12px]">
                AST
              </div>
            )}
          </div>
        </div>

        {/* Xenite Graphic */}
        <div className="shrink-0" data-name="Xenite">
          {XenGraphic ? (
            <XenGraphic />
          ) : (
            <div className="flex items-center justify-center h-[44px] w-[44px] text-white text-[12px]">
              XEN
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Choice Buttons */}
      <div
        className="content-stretch flex flex-col gap-[8px] items-start shrink-0 w-[230px]"
        data-name="Choice Buttons"
      >
        {/* Evolve Oxite (Large Button) */}
        <ActionButton
          label="Oxite"
          selected={selectedChoice === 'oxite'}
          backgroundColor={selectedChoice === 'oxite' ? 'var(--shapeships-pastel-purple)' : 'var(--shapeships-grey-20)'}
          textColor="black"
          onClick={() => onChoiceSelect('oxite')}
        />

        {/* Evolve Asterite (Large Button) */}
        <ActionButton
          label="Asterite"
          selected={selectedChoice === 'asterite'}
          backgroundColor={selectedChoice === 'asterite' ? 'var(--shapeships-pastel-purple)' : 'var(--shapeships-grey-20)'}
          textColor="black"
          onClick={() => onChoiceSelect('asterite')}
        />

        {/* Do not evolve (Small Button) */}
        <ActionButtonSmall
          label="Hold"
          selected={selectedChoice === 'hold'}
          backgroundColor={selectedChoice === 'hold' ? 'var(--shapeships-pastel-purple)' : 'var(--shapeships-grey-20)'}
          textColor="black"
          onClick={() => onChoiceSelect('hold')}
        />
      </div>
    </div>
  );
}
