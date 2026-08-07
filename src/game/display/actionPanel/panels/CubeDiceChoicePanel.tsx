import { ActionButton } from '../../../../components/ui/primitives/buttons/ActionButton';
import { Dice } from '../../../../components/ui/primitives/dice/Dice';
import { Cube } from '../../../../graphics/ancient/Cube';
import type {
  CubeDiceChoiceId,
  CubeDiceChoiceOptionVm,
  CubeDiceChoicePanelVm,
} from '../../../client/gameSession/types';

interface CubeDiceChoicePanelProps {
  vm: CubeDiceChoicePanelVm;
  layout?: 'desktop' | 'mobile';
  onSelectChoice: (
    sourceInstanceId: string,
    choiceId: CubeDiceChoiceId
  ) => void;
}

function DiceChoiceColumn({
  option,
  selected,
  layout,
  label,
  onClick,
}: {
  option: CubeDiceChoiceOptionVm;
  selected: boolean;
  layout: 'desktop' | 'mobile';
  label: string;
  onClick: () => void;
}) {
  const isMobile = layout === 'mobile';

  return (
    <div
      className={`flex shrink-0 flex-col items-center ${
        isMobile ? 'gap-[8px]' : 'gap-[12px]'
      }`}
    >
      <Dice
        value={option.value}
        className={isMobile ? '!size-[70px]' : '!size-[100px]'}
        enableRotate={false}
      />
      <ActionButton
        label={label}
        selected={selected}
        backgroundColor={
          selected ? 'var(--shapeships-pastel-orange)' : undefined
        }
        density={layout}
        className="!w-auto"
        onClick={onClick}
      />
    </div>
  );
}

export function CubeDiceChoicePanel({
  vm,
  layout = 'desktop',
  onSelectChoice,
}: CubeDiceChoicePanelProps) {
  const isMobile = layout === 'mobile';

  return (
    <div
      className={`flex w-full flex-col items-center ${
        isMobile ? 'max-w-[340px] gap-[12px]' : 'gap-[20px]'
      }`}
    >
      <p
        className={`text-center font-['Roboto'] font-bold leading-[normal] text-white ${
          isMobile ? 'text-[15px]' : 'text-[18px]'
        }`}
      >
        Choose your dice for this turn
      </p>

      <div
        className={`flex w-fit max-w-full items-start ${
          isMobile ? 'gap-[14px]' : 'gap-[20px]'
        }`}
      >
        <div
          className={`flex shrink-0 items-start ${
            isMobile ? 'gap-[8px]' : 'gap-[12px]'
          }`}
        >
          <DiceChoiceColumn
            option={vm.mainChoice}
            selected={vm.selectedChoiceId === vm.mainChoice.choiceId}
            layout={layout}
            label={`Main Dice ${vm.mainChoice.value}`}
            onClick={() =>
              onSelectChoice(vm.sourceInstanceId, vm.mainChoice.choiceId)
            }
          />
          <div className={isMobile ? 'pt-[10px]' : 'pt-[15px]'}>
            <Cube className={isMobile ? '!size-[52px]' : undefined} />
          </div>
        </div>

        <div
          className={`flex min-w-0 max-w-full flex-wrap ${
            isMobile
              ? 'gap-x-[21px] gap-y-[14px]'
              : 'gap-x-[20px] gap-y-[12px]'
          }`}
        >
          {vm.cubeChoices.map((choice) => (
            <DiceChoiceColumn
              key={choice.choiceId}
              option={choice}
              selected={vm.selectedChoiceId === choice.choiceId}
              layout={layout}
              label={`Cube ${choice.value}`}
              onClick={() =>
                onSelectChoice(vm.sourceInstanceId, choice.choiceId)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
