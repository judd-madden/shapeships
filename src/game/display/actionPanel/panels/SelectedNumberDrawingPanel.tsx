import type { ReactNode } from 'react';
import { ActionButton } from '../../../../components/ui/primitives/buttons/ActionButton';

interface SelectedNumberDrawingPanelProps {
  count: number;
  selectedNumbers: number[];
  onSelectNumber: (index: number, selectedNumber: number) => void;
  instructionText: string;
  explanationText: string;
  selectedBackgroundColor: string;
  renderGraphicSlot: (layout: 'desktop' | 'mobile') => ReactNode;
  layout?: 'desktop' | 'mobile';
  className?: string;
  panelDataName: string;
  selectorBlocksDataName: string;
  selectorBlockDataName: string;
  numberButtonsDataName: string;
  mobileSelectorBlockClassName?: string;
  mobileNumberButtonsClassName?: string;
}

export function SelectedNumberDrawingPanel({
  count,
  selectedNumbers,
  onSelectNumber,
  instructionText,
  explanationText,
  selectedBackgroundColor,
  renderGraphicSlot,
  layout = 'desktop',
  className,
  panelDataName,
  selectorBlocksDataName,
  selectorBlockDataName,
  numberButtonsDataName,
  mobileSelectorBlockClassName =
    'content-stretch mx-auto flex w-full max-w-[336px] gap-[12px] items-start shrink-0',
  mobileNumberButtonsClassName =
    'content-stretch flex min-w-0 flex-1 gap-[4px] shrink-0',
}: SelectedNumberDrawingPanelProps) {
  const isMobile = layout === 'mobile';

  if (count === 0) {
    return (
      <div className="size-full flex flex-col items-center justify-center">
        <p className="text-[var(--shapeships-grey-50)] text-[18px]">
          No actions available.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        isMobile
          ? `content-stretch flex w-full min-w-0 flex-col gap-[14px] items-center py-[4px] ${className ?? ''}`
          : `content-stretch flex flex-col gap-[32px] items-center justify-center py-[20px] size-full ${className ?? ''}`
      }
      data-name={panelDataName}
    >
      <h3
        className={`font-['Roboto',sans-serif] font-bold leading-[normal] relative shrink-0 text-white text-center ${isMobile ? 'w-full text-[15px]' : 'text-[18px]'}`}
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {instructionText}
      </h3>

      <div
        className={
          isMobile
            ? 'content-center flex w-full min-w-0 flex-col gap-[32px] items-center shrink-0'
            : 'content-center flex flex-wrap gap-[36px] items-center justify-center shrink-0 w-full'
        }
        data-name={selectorBlocksDataName}
      >
        {Array.from({ length: count }, (_, index) => (
          <SelectedNumberSelectorBlock
            key={index}
            selectedNumber={selectedNumbers[index] ?? 1}
            onSelectNumber={(selectedNumber) => onSelectNumber(index, selectedNumber)}
            graphicSlot={renderGraphicSlot(layout)}
            selectedBackgroundColor={selectedBackgroundColor}
            layout={layout}
            selectorBlockDataName={selectorBlockDataName}
            numberButtonsDataName={numberButtonsDataName}
            mobileSelectorBlockClassName={mobileSelectorBlockClassName}
            mobileNumberButtonsClassName={mobileNumberButtonsClassName}
          />
        ))}
      </div>

      <p
        className={`font-['Roboto',sans-serif] font-normal leading-[normal] shrink-0 text-center text-white w-full whitespace-pre-wrap ${isMobile ? 'text-[13px]' : 'text-[16px]'}`}
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {explanationText}
      </p>
    </div>
  );
}

interface SelectedNumberSelectorBlockProps {
  selectedNumber: number;
  onSelectNumber: (selectedNumber: number) => void;
  graphicSlot: ReactNode;
  selectedBackgroundColor: string;
  layout: 'desktop' | 'mobile';
  selectorBlockDataName: string;
  numberButtonsDataName: string;
  mobileSelectorBlockClassName: string;
  mobileNumberButtonsClassName: string;
}

function SelectedNumberSelectorBlock({
  selectedNumber,
  onSelectNumber,
  graphicSlot,
  selectedBackgroundColor,
  layout,
  selectorBlockDataName,
  numberButtonsDataName,
  mobileSelectorBlockClassName,
  mobileNumberButtonsClassName,
}: SelectedNumberSelectorBlockProps) {
  const isMobile = layout === 'mobile';

  return (
    <div
      className={
        isMobile
          ? mobileSelectorBlockClassName
          : 'content-stretch flex gap-[16px] items-center shrink-0'
      }
      data-name={selectorBlockDataName}
    >
      {graphicSlot}

      <div
        className={
          isMobile
            ? mobileNumberButtonsClassName
            : 'content-stretch flex gap-[8px] items-center shrink-0'
        }
        data-name={numberButtonsDataName}
      >
        {[1, 2, 3, 4, 5, 6].map((number) => (
          <ActionButton
            key={number}
            label={String(number)}
            selected={selectedNumber === number}
            backgroundColor={
              selectedNumber === number
                ? selectedBackgroundColor
                : 'var(--shapeships-grey-20)'
            }
            textColor="black"
            onClick={() => onSelectNumber(number)}
            density={isMobile ? 'mobile' : 'desktop'}
            className={isMobile ? '!w-auto flex-1 min-w-0' : 'w-[50px]'}
          />
        ))}
      </div>
    </div>
  );
}
