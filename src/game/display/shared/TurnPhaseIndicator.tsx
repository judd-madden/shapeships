import type { TurnPhaseMilestoneId, TurnPhaseVm } from '../../client/useGameSession';
import { ChargesIcon } from '../../../components/ui/primitives/icons/ChargesIcon';
import { DiceRollIcon } from '../../../components/ui/primitives/icons/DiceRollIcon';
import { DrawingIcon } from '../../../components/ui/primitives/icons/DrawingIcon';
import { FirstStrikeIcon } from '../../../components/ui/primitives/icons/FirstStrikeIcon';
import { HeartIcon } from '../../../components/ui/primitives/icons/HeartIcon';

function MilestoneIcon({ id }: { id: TurnPhaseMilestoneId }) {
  const props = { className: 'size-[30px]', color: 'var(--shapeships-white)' };
  if (id === 'dice_roll') return <DiceRollIcon {...props} />;
  if (id === 'drawing') return <DrawingIcon {...props} />;
  if (id === 'first_strike') return <FirstStrikeIcon {...props} />;
  if (id === 'charges') return <ChargesIcon {...props} />;
  return <HeartIcon {...props} />;
}

export function TurnPhaseIndicator({ vm }: { vm: TurnPhaseVm }) {
  const currentIndex = vm.milestones.findIndex((milestone) => milestone.id === vm.currentMilestone);
  const currentLabel = currentIndex >= 0 ? vm.milestones[currentIndex]?.label : null;

  return (
    <div className="shrink-0 overflow-hidden rounded-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)]">
      <div className="flex h-[44px] items-center px-[20px] text-[18px] font-bold text-[var(--shapeships-white)]">
        {vm.turnNumber != null ? `Turn ${vm.turnNumber}` : 'Turn Phases'}
        {currentLabel ? ` · ${currentLabel}` : ''}
      </div>
      <div className="relative grid h-[62px] grid-cols-5">
        {currentIndex >= 0 ? (
          <div
            aria-hidden="true"
            className="relative row-start-1 bg-[var(--shapeships-grey-70)]"
            style={{ gridColumnStart: currentIndex + 1 }}
          >
            <div className="absolute left-[calc(50%-9px)] top-0 h-[10px] w-[18px] bg-[var(--shapeships-grey-70)] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </div>
        ) : null}
        {vm.milestones.map((milestone) => (
          <div
            key={milestone.id}
            data-available={milestone.isAvailable}
            className={`relative z-10 col-auto row-start-1 flex items-center justify-center ${
              milestone.isAvailable ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <MilestoneIcon id={milestone.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
