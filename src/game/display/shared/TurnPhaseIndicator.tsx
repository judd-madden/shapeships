import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';
import type { TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { TURN_PHASE_PRESENTATION_TIMING } from '../../client/gameSession/clienteffects/turnPhasePresentationTiming';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';

export function TurnPhaseIndicator({ vm, presentation }: { vm: TurnPhaseVm; presentation: TurnPhasePresentationVm }) {
  const currentLabel = vm.milestones.find(
    (milestone) => milestone.id === presentation.presentedMilestone
  )?.label ?? null;
  const heading = presentation.headingContext === 'species_selection'
    ? 'Species Selection'
    : presentation.presentedTurnNumber != null
      ? `Turn ${presentation.presentedTurnNumber}`
      : 'Turn Phases';

  return (
    <div className="h-[118px] shrink-0 overflow-hidden rounded-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)]">
      <div className="flex h-[40px] items-center bg-[var(--shapeships-grey-90)] px-[18px] text-[16px] font-bold text-[var(--shapeships-white)]">
        <span>
          {heading}
          {presentation.headingContext === 'turn' && currentLabel ? ` · ${currentLabel}` : ''}
        </span>
      </div>
      <div className="relative h-[74px] pb-[2px]">
        {presentation.slabPositionIndex != null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/5 bg-[var(--shapeships-grey-70)]"
            style={{
              transform: `translateX(${presentation.slabPositionIndex * 100}%)`,
              transition: presentation.reducedMotion ? 'none' : `transform ${presentation.movementDurationMs}ms ${presentation.movementEasing}`,
            }}
          >
            <div className="absolute left-[calc(50%-9px)] top-0 h-[9px] w-[18px] bg-[var(--shapeships-grey-90)] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </div>
        ) : null}
        <div className="relative z-10 grid h-full grid-cols-5">
          {vm.milestones.map((milestone) => {
            const isCurrent = milestone.id === presentation.presentedMilestone;
            return (
              <Tooltip key={milestone.id}>
                <TooltipTrigger asChild>
                  <div data-available={milestone.isAvailable} className={`flex items-center justify-center ${isCurrent || milestone.isAvailable ? 'opacity-100' : 'opacity-20'}`} style={{ transition: presentation.reducedMotion ? 'none' : `opacity ${TURN_PHASE_PRESENTATION_TIMING.availabilityFadeMs}ms ease` }}>
                    <TurnPhaseMilestoneIcon id={milestone.id} className="size-[34px]" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>{milestone.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
