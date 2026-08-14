import { useState } from 'react';
import type { TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { TURN_PHASE_PRESENTATION_TIMING } from '../../client/gameSession/clienteffects/turnPhasePresentationTiming';
import {
  TurnPhaseHoverLabel,
  type TurnPhaseHoverLabelValue,
  TurnPhaseMilestoneIcon,
} from './TurnPhasePrimitives';
import { useHoverPanelPresence } from './useHoverPanelPresence';

export function TurnPhaseIndicator({ vm, presentation }: { vm: TurnPhaseVm; presentation: TurnPhasePresentationVm }) {
  const [activeHover, setActiveHover] = useState<TurnPhaseHoverLabelValue | null>(null);
  const { presentValue, motionState } = useHoverPanelPresence(activeHover);
  const currentLabel = vm.milestones.find(
    (milestone) => milestone.id === presentation.presentedMilestone
  )?.label ?? null;
  const isRepositioning = presentation.wrapStage === 'reposition';
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
              opacity: isRepositioning ? 0 : 1,
              transform: `translateX(${presentation.slabPositionIndex * 100}%)`,
              transition: presentation.reducedMotion || isRepositioning
                ? 'none'
                : `transform ${presentation.movementDurationMs}ms ${presentation.movementEasing}`,
            }}
          >
            <div className="absolute left-[calc(50%-9px)] top-0 h-[9px] w-[18px] bg-[var(--shapeships-grey-90)] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </div>
        ) : null}
        <div className="relative z-10 grid h-full grid-cols-5">
          {vm.milestones.map((milestone) => {
            const isCurrent = milestone.id === presentation.presentedMilestone;
            return (
              <div
                key={milestone.id}
                data-available={milestone.isAvailable}
                className={`flex items-center justify-center ${isCurrent || milestone.isAvailable ? 'opacity-100' : 'opacity-30'}`}
                style={{ transition: presentation.reducedMotion ? 'none' : `opacity ${TURN_PHASE_PRESENTATION_TIMING.availabilityFadeMs}ms ease` }}
                onPointerEnter={(event) => {
                  setActiveHover({
                    milestoneId: milestone.id,
                    label: milestone.label,
                    anchorRect: event.currentTarget.getBoundingClientRect(),
                  });
                }}
                onPointerLeave={() => setActiveHover(null)}
              >
                <TurnPhaseMilestoneIcon id={milestone.id} className="size-[34px]" />
              </div>
            );
          })}
        </div>
      </div>
      {presentValue ? (
        <TurnPhaseHoverLabel value={presentValue} motionState={motionState} />
      ) : null}
    </div>
  );
}
