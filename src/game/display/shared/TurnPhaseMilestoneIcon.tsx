import type { TurnPhaseMilestoneId } from '../../client/useGameSession';
import { ChargesIcon } from '../../../components/ui/primitives/icons/ChargesIcon';
import { DiceRollIcon } from '../../../components/ui/primitives/icons/DiceRollIcon';
import { DrawingIcon } from '../../../components/ui/primitives/icons/DrawingIcon';
import { FirstStrikeIcon } from '../../../components/ui/primitives/icons/FirstStrikeIcon';
import { HeartIcon } from '../../../components/ui/primitives/icons/HeartIcon';

export function TurnPhaseMilestoneIcon({ id, className }: { id: TurnPhaseMilestoneId; className: string }) {
  const props = { className, color: 'var(--shapeships-white)' };
  if (id === 'dice_roll') return <DiceRollIcon {...props} />;
  if (id === 'drawing') return <DrawingIcon {...props} />;
  if (id === 'first_strike') return <FirstStrikeIcon {...props} />;
  if (id === 'charges') return <ChargesIcon {...props} />;
  return <HeartIcon {...props} />;
}
