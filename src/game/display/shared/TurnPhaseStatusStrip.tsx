import type { TurnPhaseVm } from '../../client/useGameSession';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';

export function TurnPhaseStatusStrip({ vm }: { vm: TurnPhaseVm }) {
  const currentIndex = vm.milestones.findIndex((milestone) => milestone.id === vm.currentMilestone);

  return (
    <div className="relative grid h-[27px] grid-cols-5 overflow-hidden rounded-[4px] bg-[var(--shapeships-black)]">
      {currentIndex >= 0 ? <div aria-hidden="true" className="row-start-1 bg-[var(--shapeships-grey-70)]" style={{ gridColumnStart: currentIndex + 1 }} /> : null}
      {vm.milestones.map((milestone) => {
        const isCurrent = milestone.id === vm.currentMilestone;
        return (
          <div key={milestone.id} className={`relative z-10 row-start-1 flex items-center justify-center ${isCurrent || milestone.isAvailable ? 'opacity-100' : 'opacity-20'}`}>
            <TurnPhaseMilestoneIcon id={milestone.id} className="size-[18px]" />
          </div>
        );
      })}
    </div>
  );
}
