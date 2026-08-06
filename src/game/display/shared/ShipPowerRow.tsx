import type { ReactNode } from 'react';
import { ChargesIcon } from '../../../components/ui/primitives/icons/ChargesIcon';
import { DiceRollIcon } from '../../../components/ui/primitives/icons/DiceRollIcon';
import { DrawingIcon } from '../../../components/ui/primitives/icons/DrawingIcon';
import { FirstStrikeIcon } from '../../../components/ui/primitives/icons/FirstStrikeIcon';
import type { ShipPowerTimingIconKind } from '../../data/ShipPowerPresentation';

interface ShipPowerRowProps {
  iconKind: ShipPowerTimingIconKind;
  children: ReactNode;
  className?: string;
  fallbackIconClassName?: string;
}

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function TimingIcon({ iconKind }: { iconKind: Exclude<ShipPowerTimingIconKind, 'fallback'> }) {
  const className = 'shrink-0 opacity-50';

  switch (iconKind) {
    case 'dice-roll':
      return <DiceRollIcon className={className} color="white" />;
    case 'drawing':
      return <DrawingIcon className={className} color="white" />;
    case 'first-strike':
      return <FirstStrikeIcon className={className} color="white" />;
    case 'charges':
      return <ChargesIcon className={className} color="white" />;
  }
}

export function ShipPowerRow({
  iconKind,
  children,
  className,
  fallbackIconClassName,
}: ShipPowerRowProps) {
  return (
    <div className={cx('flex w-full items-start gap-[6px]', className)}>
      {iconKind === 'fallback' ? (
        <div
          aria-hidden="true"
          className={cx(
            'flex w-[26px] shrink-0 justify-end pt-[6px]',
            fallbackIconClassName,
          )}
        >
          <span className="size-[8px] rounded-full bg-white/50" />
        </div>
      ) : (
        <div aria-hidden="true" className="flex w-[26px] shrink-0 items-start justify-center">
          <TimingIcon iconKind={iconKind} />
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">{children}</div>
    </div>
  );
}
