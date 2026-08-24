import type { ComponentType } from 'react';
import { Dice } from '../../../components/ui/primitives';
import { Cube } from '../../../graphics/ancient/Cube';
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

  const ShipGraphic = (() => {
    if (slot.sourceShipDefId === 'CUB') return null;

    const def = getShipDefinitionUI(slot.sourceShipDefId);
    if (!def) return null;
    return resolveShipGraphic(def, { context: 'default' })?.component ?? null;
  })();
  const diceValues = Array.isArray(slot.diceValues) ? slot.diceValues : [];
  const groupPositionClassName =
    side === 'top'
      ? 'right-[8px] bottom-full mb-[-12px]'
      : 'right-[8px] top-full mt-[-12px]';

  return (
    <div
      className={`pointer-events-none absolute z-20 flex w-max flex-col items-center gap-[6px] ${groupPositionClassName}`}
      aria-hidden="true"
    >
      {side === 'top' ? (
        <>
          <DiceStack slot={slot} diceValues={diceValues} />
          <ShipIcon slot={slot} ShipGraphic={ShipGraphic} />
        </>
      ) : (
        <>
          <ShipIcon slot={slot} ShipGraphic={ShipGraphic} />
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

  const isAnimatedModifier =
    slot.sourceShipDefId === 'CHR' || slot.sourceShipDefId === 'CUB';

  return (
    <div className="flex flex-col items-center gap-[1px]">
      {diceValues.map((value, index) => (
        <Dice
          key={`${slot.sourceShipDefId}-${index}`}
          value={value}
          animateKey={isAnimatedModifier ? slot.animateKey : undefined}
          className="h-[22px] w-[22px]"
          enableRotate={false}
        />
      ))}
    </div>
  );
}

function ShipIcon({
  slot,
  ShipGraphic,
}: {
  slot: NonNullable<MobileDiceModifierSlot>;
  ShipGraphic: ComponentType<{ className?: string }> | null;
}) {
  if (slot.sourceShipDefId === 'CUB') {
    return (
      <div className="h-[22px] w-[22px]">
        <Cube className="h-[22px] w-[22px]" highlighted={slot.highlighted === true} />
      </div>
    );
  }

  if (!ShipGraphic) {
    return null;
  }

  return (
    <div className="h-[22px] w-[22px]">
      <ShipGraphic className="h-[22px] w-[22px]" />
    </div>
  );
}
