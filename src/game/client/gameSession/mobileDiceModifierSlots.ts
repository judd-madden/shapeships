import type {
  MobileDiceModifierShipDefId,
  MobileDiceModifierSlotViewModel,
  MobileDiceModifierSlotsViewModel,
} from './types';

type DiceValue = NonNullable<MobileDiceModifierSlotViewModel['diceValues']>[number];
type Side = 'top' | 'bottom';

interface SidePresence {
  hasChr: boolean;
  hasLev: boolean;
  hasKno: boolean;
}

export function deriveMobileDiceModifierSlots(args: {
  shipsByPlayerId: Record<string, any[]>;
  topPlayerId: string | null | undefined;
  bottomPlayerId: string | null | undefined;
  turnNumber: number;
  chronoswarmRolls?: unknown[];
  chronoswarmAnimateKey?: number;
  cubeDiceValueByPlayerId?: Record<string, unknown>;
  cubeDiceAnimateKeyByPlayerId?: Record<string, number | string>;
}): MobileDiceModifierSlotsViewModel {
  const {
    shipsByPlayerId,
    topPlayerId,
    bottomPlayerId,
    turnNumber,
    chronoswarmRolls,
    chronoswarmAnimateKey,
    cubeDiceValueByPlayerId = {},
    cubeDiceAnimateKeyByPlayerId = {},
  } = args;
  const normalizedChronoswarmRolls = normalizeDiceValues(chronoswarmRolls);

  const topPresence = getSidePresence(shipsByPlayerId, topPlayerId, turnNumber);
  const bottomPresence = getSidePresence(shipsByPlayerId, bottomPlayerId, turnNumber);

  const chronoswarmSide: Side | null =
    bottomPresence.hasChr ? 'bottom' : topPresence.hasChr ? 'top' : null;

  return {
    top: makeSlotForSide({
      side: 'top',
      presence: topPresence,
      chronoswarmSide,
      chronoswarmRolls: normalizedChronoswarmRolls,
      chronoswarmAnimateKey,
      cubeDiceValue: normalizeDiceValue(
        topPlayerId ? cubeDiceValueByPlayerId[topPlayerId] : undefined
      ),
      cubeDiceAnimateKey:
        topPlayerId ? cubeDiceAnimateKeyByPlayerId[topPlayerId] : undefined,
    }),
    bottom: makeSlotForSide({
      side: 'bottom',
      presence: bottomPresence,
      chronoswarmSide,
      chronoswarmRolls: normalizedChronoswarmRolls,
      chronoswarmAnimateKey,
      cubeDiceValue: normalizeDiceValue(
        bottomPlayerId ? cubeDiceValueByPlayerId[bottomPlayerId] : undefined
      ),
      cubeDiceAnimateKey:
        bottomPlayerId ? cubeDiceAnimateKeyByPlayerId[bottomPlayerId] : undefined,
    }),
  };
}

function getSidePresence(
  shipsByPlayerId: Record<string, any[]>,
  playerId: string | null | undefined,
  turnNumber: number
): SidePresence {
  const ships = playerId ? shipsByPlayerId[playerId] : [];
  const eligibleShipDefIds = new Set<MobileDiceModifierShipDefId>();

  if (!Array.isArray(ships)) {
    return { hasChr: false, hasLev: false, hasKno: false };
  }

  for (const ship of ships) {
    if (!isDiceModifierDisplayEligibleForCurrentTurn(ship, turnNumber)) {
      continue;
    }

    const shipDefId = String(ship?.shipDefId ?? '');
    if (shipDefId === 'CHR' || shipDefId === 'LEV' || shipDefId === 'KNO') {
      eligibleShipDefIds.add(shipDefId);
    }
  }

  return {
    hasChr: eligibleShipDefIds.has('CHR'),
    hasLev: eligibleShipDefIds.has('LEV'),
    hasKno: eligibleShipDefIds.has('KNO'),
  };
}

function isDiceModifierDisplayEligibleForCurrentTurn(ship: any, turnNumber: number): boolean {
  const createdTurn = ship?.createdTurn;
  if (!Number.isInteger(createdTurn)) return true;
  return createdTurn < turnNumber;
}

function makeSlotForSide(args: {
  side: Side;
  presence: SidePresence;
  chronoswarmSide: Side | null;
  chronoswarmRolls: DiceValue[];
  chronoswarmAnimateKey?: number;
  cubeDiceValue: DiceValue | null;
  cubeDiceAnimateKey?: number | string;
}): MobileDiceModifierSlotViewModel | null {
  const {
    side,
    presence,
    chronoswarmSide,
    chronoswarmRolls,
    chronoswarmAnimateKey,
    cubeDiceValue,
    cubeDiceAnimateKey,
  } = args;

  if (chronoswarmSide === side) {
    return {
      sourceShipDefId: 'CHR',
      diceValues: chronoswarmRolls,
      animateKey: chronoswarmAnimateKey,
    };
  }

  if (cubeDiceValue !== null) {
    return {
      sourceShipDefId: 'CUB',
      diceValues: [cubeDiceValue],
      animateKey: cubeDiceAnimateKey,
    };
  }

  if (presence.hasLev) {
    return {
      sourceShipDefId: 'LEV',
      diceValues: [6],
    };
  }

  if (presence.hasKno) {
    return {
      sourceShipDefId: 'KNO',
    };
  }

  return null;
}

function normalizeDiceValue(value: unknown): DiceValue | null {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  )
    ? value as DiceValue
    : null;
}

function normalizeDiceValues(values: unknown[] | undefined): DiceValue[] {
  return Array.isArray(values)
    ? values.filter(
        (value): value is DiceValue =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 6
      )
    : [];
}
