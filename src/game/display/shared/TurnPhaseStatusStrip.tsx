import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { TURN_PHASE_PRESENTATION_TIMING } from '../../client/gameSession/clienteffects/turnPhasePresentationTiming';
import {
  TurnPhaseHoverLabel,
  type TurnPhaseHoverLabelValue,
} from './TurnPhaseHoverLabel';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';
import { useHoverPanelPresence } from './useHoverPanelPresence';

export function TurnPhaseStatusStrip({ vm, presentation }: { vm: TurnPhaseVm; presentation: TurnPhasePresentationVm }) {
  const activePointerIdRef = useRef<number | null>(null);
  const [activePress, setActivePress] = useState<TurnPhaseHoverLabelValue | null>(null);
  const { presentValue, motionState } = useHoverPanelPresence(activePress);

  const dismissPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    setActivePress(null);
  };

  return (
    <div className="relative h-[32px]">
      <div className="relative h-full overflow-hidden rounded-[4px] bg-[var(--shapeships-grey-90)]">
        {presentation.slabPositionIndex != null ? <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/5 bg-[var(--shapeships-grey-70)]" style={{ transform: `translateX(${presentation.slabPositionIndex * 100}%)`, transition: presentation.reducedMotion ? 'none' : `transform ${presentation.movementDurationMs}ms ${presentation.movementEasing}` }} /> : null}
        <div className="relative z-10 grid h-full grid-cols-5">
          {vm.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={`flex select-none items-center justify-center ${milestone.id === presentation.presentedMilestone || milestone.isAvailable ? 'opacity-100' : 'opacity-30'}`}
              style={{ transition: presentation.reducedMotion ? 'none' : `opacity ${TURN_PHASE_PRESENTATION_TIMING.availabilityFadeMs}ms ease` }}
              onPointerDown={(event) => {
                if (activePointerIdRef.current !== null) {
                  return;
                }

                activePointerIdRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                setActivePress({
                  milestoneId: milestone.id,
                  label: milestone.label,
                  anchorRect: event.currentTarget.getBoundingClientRect(),
                });
              }}
              onPointerUp={dismissPointer}
              onPointerCancel={dismissPointer}
              onLostPointerCapture={dismissPointer}
              onContextMenu={(event) => event.preventDefault()}
            >
              <TurnPhaseMilestoneIcon id={milestone.id} className="size-[18px]" />
            </div>
          ))}
        </div>
      </div>
      {presentValue ? (
        <TurnPhaseHoverLabel value={presentValue} motionState={motionState} />
      ) : null}
    </div>
  );
}
