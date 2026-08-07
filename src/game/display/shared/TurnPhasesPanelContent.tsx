import type { TurnPhaseMilestoneId, TurnPhaseVm } from '../../client/useGameSession';
import { ChargesIcon } from '../../../components/ui/primitives/icons/ChargesIcon';
import { DiceRollIcon } from '../../../components/ui/primitives/icons/DiceRollIcon';
import { DrawingIcon } from '../../../components/ui/primitives/icons/DrawingIcon';
import { FirstStrikeIcon } from '../../../components/ui/primitives/icons/FirstStrikeIcon';
import { HeartIcon } from '../../../components/ui/primitives/icons/HeartIcon';
import { LeftRailScrollArea } from '../layout/leftRail/LeftRailScrollArea';

function MilestoneIcon({ id }: { id: TurnPhaseMilestoneId }) {
  const props = { className: 'size-[24px]', color: 'var(--shapeships-white)' };
  if (id === 'dice_roll') return <DiceRollIcon {...props} />;
  if (id === 'drawing') return <DrawingIcon {...props} />;
  if (id === 'first_strike') return <FirstStrikeIcon {...props} />;
  if (id === 'charges') return <ChargesIcon {...props} />;
  return <HeartIcon {...props} />;
}

export function TurnPhasesPanelContent({ vm }: { vm: TurnPhaseVm }) {
  return (
    <LeftRailScrollArea outerClassName="basis-0 flex-1 px-[18px] py-[14px]">
      <p className="mb-[10px] text-[14px] font-bold text-[var(--shapeships-grey-20)]">
        ↓ START OF TURN
      </p>
      <div className="flex flex-col gap-[4px]">
        {vm.milestones.map((milestone) => {
          const isCurrent = milestone.id === vm.currentMilestone;
          return (
            <div
              key={milestone.id}
              data-current={isCurrent || undefined}
              data-available={milestone.isAvailable}
              className={`flex min-h-[38px] items-center gap-[10px] rounded-[5px] px-[10px] ${
                isCurrent ? 'bg-[var(--shapeships-grey-90)]' : ''
              } ${milestone.isAvailable ? 'opacity-100' : 'opacity-50'}`}
            >
              <MilestoneIcon id={milestone.id} />
              <span className="text-[15px] font-medium text-[var(--shapeships-white)]">
                {milestone.label}
              </span>
            </div>
          );
        })}
      </div>
    </LeftRailScrollArea>
  );
}
