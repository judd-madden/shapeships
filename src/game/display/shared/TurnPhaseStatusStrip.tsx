import type { TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { TURN_PHASE_PRESENTATION_TIMING } from '../../client/gameSession/clienteffects/turnPhasePresentationTiming';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';

export function TurnPhaseStatusStrip({ vm, presentation }: { vm: TurnPhaseVm; presentation: TurnPhasePresentationVm }) {
  const currentIndex = vm.milestones.findIndex((milestone) => milestone.id === presentation.presentedMilestone);

  return (
    <div className="relative h-[27px] overflow-hidden rounded-[4px] bg-[var(--shapeships-black)]">
      {currentIndex >= 0 ? <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/5 bg-[var(--shapeships-grey-70)]" style={{ transform: `translateX(${currentIndex * 100}%)`, transition: presentation.reducedMotion ? 'none' : `transform ${presentation.movementDurationMs}ms ${presentation.movementEasing}` }} /> : null}
      <div className="relative z-10 grid h-full grid-cols-5">
      {vm.milestones.map((milestone) => {
        return (
          <div key={milestone.id} className={`flex items-center justify-center ${milestone.id === presentation.presentedMilestone || milestone.isAvailable ? 'opacity-100' : 'opacity-20'}`} style={{ transition: presentation.reducedMotion ? 'none' : `opacity ${TURN_PHASE_PRESENTATION_TIMING.availabilityFadeMs}ms ease` }}>
            <TurnPhaseMilestoneIcon id={milestone.id} className="size-[18px]" />
          </div>
        );
      })}
      </div>
    </div>
  );
}
