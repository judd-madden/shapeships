import { DownArrowIcon } from '../../../components/ui/primitives';
import type { TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { TURN_PHASE_PRESENTATION_TIMING } from '../../client/gameSession/clienteffects/turnPhasePresentationTiming';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';

export function TurnPhaseList({ vm, presentation }: { vm: TurnPhaseVm; presentation: TurnPhasePresentationVm }) {
  const verticalSlabOpacity = presentation.wrapStage === 'reposition' ? 0 : 1;

  return (
    <div>
      <p className="mb-[10px] flex items-center gap-[8px] text-[14px] font-bold text-[var(--shapeships-white)]">
        <DownArrowIcon color="currentColor" />
        START OF TURN
      </p>
      <div className="relative grid grid-rows-[repeat(5,32px)] gap-[8px]">
        {presentation.slabPositionIndex != null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-[32px] rounded-[5px] bg-[var(--shapeships-grey-90)]"
            style={{
              opacity: verticalSlabOpacity,
              transform: `translateY(${presentation.slabPositionIndex * 40}px)`,
              transition: presentation.reducedMotion || presentation.wrapStage === 'reposition'
                ? 'none'
                : `transform ${presentation.movementDurationMs}ms ${presentation.movementEasing}, opacity ${presentation.movementDurationMs}ms ease`,
            }}
          />
        ) : null}
        {vm.milestones.map((milestone) => {
          const isCurrent = milestone.id === presentation.presentedMilestone;
          return (
            <div key={milestone.id} data-current={isCurrent || undefined} data-available={milestone.isAvailable} className={`relative z-10 flex h-[32px] items-center gap-[8px] px-[10px] ${isCurrent || milestone.isAvailable ? 'opacity-100' : 'opacity-20'}`} style={{ transition: presentation.reducedMotion ? 'none' : `opacity ${TURN_PHASE_PRESENTATION_TIMING.availabilityFadeMs}ms ease` }}>
              <TurnPhaseMilestoneIcon id={milestone.id} className="size-[24px]" />
              <span className="text-[15px] font-normal text-[var(--shapeships-white)]">{milestone.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
