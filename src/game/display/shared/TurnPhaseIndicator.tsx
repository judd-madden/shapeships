import { ChevronDown } from '../../../components/ui/primitives/icons/ChevronDown';
import type { TurnPhaseVm } from '../../client/useGameSession';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';

export function TurnPhaseIndicator({ vm }: { vm: TurnPhaseVm }) {
  const currentIndex = vm.milestones.findIndex((milestone) => milestone.id === vm.currentMilestone);
  const currentLabel = currentIndex >= 0 ? vm.milestones[currentIndex]?.label : null;

  return (
    <div className="h-[118px] shrink-0 overflow-hidden rounded-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)]">
      <div className="flex h-[40px] items-center justify-between bg-[var(--shapeships-grey-90)] pl-[18px] pr-[12px] text-[16px] font-bold text-[var(--shapeships-white)]">
        <span>
          {vm.turnNumber != null ? `Turn ${vm.turnNumber}` : 'Turn Phases'}
          {currentLabel ? ` · ${currentLabel}` : ''}
        </span>
        <span aria-hidden="true">
          <ChevronDown className="size-[18px]! -rotate-90 opacity-0" color="var(--shapeships-white)" />
        </span>
      </div>
      <div className="relative grid h-[74px] grid-cols-5 pb-[2px]">
        {currentIndex >= 0 ? (
          <div aria-hidden="true" className="relative row-start-1 bg-[var(--shapeships-grey-70)]" style={{ gridColumnStart: currentIndex + 1 }}>
            <div className="absolute left-[calc(50%-9px)] top-0 h-[9px] w-[18px] bg-[var(--shapeships-grey-90)] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </div>
        ) : null}
        {vm.milestones.map((milestone) => {
          const isCurrent = milestone.id === vm.currentMilestone;
          return (
            <div key={milestone.id} data-available={milestone.isAvailable} className={`relative z-10 col-auto row-start-1 flex items-center justify-center ${isCurrent || milestone.isAvailable ? 'opacity-100' : 'opacity-20'}`}>
              <TurnPhaseMilestoneIcon id={milestone.id} className="size-[34px]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
