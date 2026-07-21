import { getShipDefinitionNameForCount } from '../../../data/ShipDefinitionNames';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import { SelectedNumberDrawingPanel } from './SelectedNumberDrawingPanel';

interface FrigateDrawingPanelProps {
  frigateCount: number;
  selectedTriggers: number[];
  onSelectTrigger: (frigateIndex: number, triggerNumber: number) => void;
  layout?: 'desktop' | 'mobile';
  className?: string;
}

export function FrigateDrawingPanel({
  frigateCount,
  selectedTriggers,
  onSelectTrigger,
  layout = 'desktop',
  className,
}: FrigateDrawingPanelProps) {
  const frigateDef = getShipDefinitionUI('FRI');
  const frigateGraphic = frigateDef
    ? resolveShipGraphic(frigateDef, { context: 'default' })
    : undefined;
  const FrigateGraphic = frigateGraphic?.component;
  const frigateName = getShipDefinitionNameForCount('FRI', frigateCount);

  return (
    <SelectedNumberDrawingPanel
      count={frigateCount}
      selectedNumbers={selectedTriggers}
      onSelectNumber={onSelectTrigger}
      instructionText={`Choose a permanent trigger number for your ${frigateName}.`}
      explanationText="When the dice match this number, deal 6 damage (including on this turn)."
      selectedBackgroundColor="var(--shapeships-yellow)"
      renderGraphicSlot={(resolvedLayout) => {
        const isMobile = resolvedLayout === 'mobile';

        return (
          <div
            className={isMobile ? 'relative h-[70px] w-[42px] shrink-0 overflow-visible' : 'shrink-0'}
            data-name="Frigate Graphic"
          >
            <div className={isMobile ? 'origin-top-left scale-[0.78]' : ''}>
              {FrigateGraphic ? (
                <FrigateGraphic />
              ) : (
                <div className={isMobile ? 'flex h-[70px] w-[42px] items-center justify-center text-white text-[13px]' : 'flex items-center justify-center h-[88px] w-[52px] text-white text-[14px]'}>
                  FRI
                </div>
              )}
            </div>
          </div>
        );
      }}
      layout={layout}
      className={className}
      panelDataName="Frigate Drawing Panel"
      selectorBlocksDataName="Frigate Selector Blocks"
      selectorBlockDataName="Frigate Selector Block"
      numberButtonsDataName="Trigger Number Buttons"
    />
  );
}
