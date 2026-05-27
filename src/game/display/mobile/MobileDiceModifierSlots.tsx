import type { ComponentType } from 'react';
import { Dice } from '../../../components/ui/primitives';
import type { BoardViewModel } from '../../client/useGameSession';
import { getShipDefinitionUI } from '../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../graphics/resolveShipGraphic';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;
type MobileDiceModifierSlot = MobileBoardViewModel['mobileDiceModifierSlots']['top'];

interface MobileDiceModifierSlotsProps {
  slots: MobileBoardViewModel['mobileDiceModifierSlots'];
}

export function MobileDiceModifierSlots({ slots }: MobileDiceModifierSlotsProps) {
  if (!slots.top && !slots.bottom) {
    return null;
  }

  return (
    <>
      <MobileDiceModifierGroup slot={slots.top} side="top" />
      <MobileDiceModifierGroup slot={slots.bottom} side="bottom" />
    </>
  );
}

function MobileDiceModifierGroup({
  slot,
  side,
}: {
  slot: MobileDiceModifierSlot;
  side: 'top' | 'bottom';
}) {
  if (!slot) {
    return null;
  }

  const def = getShipDefinitionUI(slot.sourceShipDefId);
  if (!def) {
    return null;
  }

  const graphic = resolveShipGraphic(def, { context: 'default' });
  const ShipGraphic = graphic?.component ?? null;
  const diceValues = Array.isArray(slot.diceValues) ? slot.diceValues : [];
  const groupPositionClassName =
    side === 'top'
      ? 'right-[16px] bottom-full mb-[2px]'
      : 'right-[16px] top-full';

  return (
    <div
      className={`pointer-events-none absolute z-20 flex w-max flex-col items-center gap-[6px] ${groupPositionClassName}`}
      aria-hidden="true"
    >
      {side === 'top' ? (
        <>
          <DiceStack slot={slot} diceValues={diceValues} />
          <ShipIcon ShipGraphic={ShipGraphic} />
        </>
      ) : (
        <>
          <ShipIcon ShipGraphic={ShipGraphic} />
          <DiceStack slot={slot} diceValues={diceValues} />
        </>
      )}
    </div>
  );
}

function DiceStack({
  slot,
  diceValues,
}: {
  slot: NonNullable<MobileDiceModifierSlot>;
  diceValues: NonNullable<MobileDiceModifierSlot>['diceValues'];
}) {
  if (!diceValues || diceValues.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-[1px]">
      {diceValues.map((value, index) => (
        <Dice
          key={`${slot.sourceShipDefId}-${index}`}
          value={value}
          animateKey={slot.sourceShipDefId === 'CHR' ? slot.animateKey : undefined}
          className="h-[24px] w-[24px]"
          enableRotate={false}
        />
      ))}
    </div>
  );
}

function ShipIcon({
  ShipGraphic,
}: {
  ShipGraphic: ComponentType<{ className?: string }> | null;
}) {
  if (!ShipGraphic) {
    return null;
  }

  return (
    <div className="h-[28px] w-[28px]">
      <ShipGraphic className="h-[28px] w-[28px]" />
    </div>
  );
}
