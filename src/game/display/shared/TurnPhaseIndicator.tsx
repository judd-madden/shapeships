import { ChevronDown } from '../../../components/ui/primitives/icons/ChevronDown';
import type { TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { TURN_PHASE_PRESENTATION_TIMING } from '../../client/gameSession/clienteffects/turnPhasePresentationTiming';
import { TurnPhaseMilestoneIcon } from './TurnPhaseMilestoneIcon';

export function TurnPhaseIndicator({ vm, presentation }: { vm: TurnPhaseVm; presentation: TurnPhasePresentationVm }) {
  const currentIndex = vm.milestones.findIndex((milestone) => milestone.id === presentation.presentedMilestone);
  const currentLabel = currentIndex >= 0 ? vm.milestones[currentIndex]?.label : null;

  return (
    <div className="h-[118px] shrink-0 overflow-hidden rounded-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)]">
      <div className="flex h-[40px] items-center justify-between bg-[var(--shapeships-grey-90)] pl-[18px] pr-[12px] text-[16px] font-bold text-[var(--shapeships-white)]">
        <span>
          {presentation.presentedTurnNumber != null ? `Turn ${presentation.presentedTurnNumber}` : 'Turn Phases'}
          {currentLabel ? ` · ${currentLabel}` : ''}
        </span>
        <span
          key={presentation.advancePulseKey}
          aria-hidden="true"
          className={presentation.advancePulseKey > 0 && !presentation.reducedMotion ? 'ss-turnPhaseChevronPulse' : 'opacity-0'}
          style={{ animationDuration: `${TURN_PHASE_PRESENTATION_TIMING.advanceChevronBlinkMs}ms` }}
        >
          <ChevronDown
            className="size-[18px]! -rotate-90"
            color="var(--shapeships-white)"
          />
        </span>
      </div>
      <div className="relative h-[74px] pb-[2px]">
        {currentIndex >= 0 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/5 bg-[var(--shapeships-grey-70)]"
            style={{
              transform: `translateX(${currentIndex * 100}%)`,
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
            <div key={milestone.id} data-available={milestone.isAvailable} className={`flex items-center justify-center ${isCurrent || milestone.isAvailable ? 'opacity-100' : 'opacity-20'}`} style={{ transition: presentation.reducedMotion ? 'none' : `opacity ${TURN_PHASE_PRESENTATION_TIMING.availabilityFadeMs}ms ease` }}>
              <TurnPhaseMilestoneIcon id={milestone.id} className="size-[34px]" />
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}
