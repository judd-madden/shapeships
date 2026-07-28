import { getShipDefinitionNameForCount } from '../../../data/ShipDefinitionNames';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import { SelectedNumberDrawingPanel } from './SelectedNumberDrawingPanel';

interface QuantumMysticDrawingPanelProps {
  quantumMysticCount: number;
  selectedNumbers: number[];
  onSelectNumber: (quantumMysticIndex: number, selectedNumber: number) => void;
  layout?: 'desktop' | 'mobile';
  className?: string;
}

export function QuantumMysticDrawingPanel({
  quantumMysticCount,
  selectedNumbers,
  onSelectNumber,
  layout = 'desktop',
  className,
}: QuantumMysticDrawingPanelProps) {
  const quantumMysticDef = getShipDefinitionUI('QUA');
  const quantumMysticGraphic = quantumMysticDef
    ? resolveShipGraphic(quantumMysticDef, { context: 'default' })
    : undefined;
  const QuantumMysticGraphic = quantumMysticGraphic?.component;
  const quantumMysticName = getShipDefinitionNameForCount('QUA', quantumMysticCount);

  return (
    <SelectedNumberDrawingPanel
      count={quantumMysticCount}
      selectedNumbers={selectedNumbers}
      onSelectNumber={onSelectNumber}
      instructionText={`Choose a permanent trigger number for your ${quantumMysticName}.`}
      explanationText="When the dice match this number, gain 2 blue Energy and heal 5 (including on this turn)."
      selectedBackgroundColor="var(--shapeships-pastel-purple)"
      renderGraphicSlot={(resolvedLayout) => {
        const isMobile = resolvedLayout === 'mobile';

        return (
          <div
            className={
              isMobile
                ? 'relative flex h-[50px] w-[42px] shrink-0 items-center overflow-visible'
                : 'relative flex h-[88px] w-[90px] shrink-0 items-center overflow-visible'
            }
            data-name="Quantum Mystic Graphic"
          >
            {QuantumMysticGraphic ? (
              <QuantumMysticGraphic
                className={isMobile ? 'h-auto w-[42px]' : undefined}
              />
            ) : (
              <div
                className={
                  isMobile
                    ? 'flex h-[57px] w-[42px] items-center justify-center text-white text-[13px]'
                    : 'flex h-[57px] w-[90px] items-center justify-center text-white text-[13px]'
                }
              >
                QUA
              </div>
            )}
          </div>
        );
      }}
      layout={layout}
      className={className}
      panelDataName="Quantum Mystic Drawing Panel"
      selectorBlocksDataName="Quantum Mystic Selector Blocks"
      selectorBlockDataName="Quantum Mystic Selector Block"
      numberButtonsDataName="Selected Number Buttons"
      mobileSelectorBlockClassName="content-stretch mx-auto flex w-fit max-w-none gap-[12px] items-start shrink-0"
      mobileNumberButtonsClassName="content-stretch flex w-[282px] min-w-[282px] gap-[4px] shrink-0"
    />
  );
}
