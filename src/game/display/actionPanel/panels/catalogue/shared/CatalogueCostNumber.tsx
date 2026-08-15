/**
 * Catalogue Cost Number
 * 
 * Pure presentational component for numeric cost display.
 * Inherits opacity from parent slot.
 * 
 * PASS 1 - UI-only component
 */

import { useContext } from 'react';
import { ChallengeIcon } from '../../../../../../components/ui/primitives/icons/ChallengeIcon';
import { CatalogueChallengeConditionContext } from './CatalogueShipSlot';

interface CatalogueCostNumberProps {
  cost: number;
  className?: string;
}

export function CatalogueCostNumber({ cost, className = '' }: CatalogueCostNumberProps) {
  const challengeCondition = useContext(CatalogueChallengeConditionContext);
  const challengeColorClassName = challengeCondition === 'with'
    ? 'text-[var(--shapeships-pastel-green)]'
    : 'text-[var(--shapeships-pastel-red)]';

  return (
    <p
      className={`font-bold leading-[normal] text-[18px] pt-[6px] text-center text-white ${className}`}
    >
      <span className="inline-flex items-center justify-center gap-[6px]">
        <span>{cost}</span>
        {challengeCondition ? (
          <ChallengeIcon
            className={`mt-[2px] h-auto w-[19px] shrink-0 ${challengeColorClassName}`}
          />
        ) : null}
      </span>
    </p>
  );
}
