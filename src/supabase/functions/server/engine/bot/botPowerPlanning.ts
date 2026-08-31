import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import type {
  PowerActionPayload,
} from '../intent/IntentTypes.ts';
import type {
  DamageHealChargePolicy,
  DamageHealChargePolicyMap,
  DamageHealChargeShipDefId,
  DamageHealChoiceId,
} from './botTypes.ts';

const DEFAULT_MISSING_DAMAGE_HEAL_CHARGE_POLICY: DamageHealChargePolicy = {
  healSelfAtOrBelow: 14,
  damageOpponentAtOrBelow: 12,
};

const DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS: readonly DamageHealChargeShipDefId[] = [
  'INT',
  'ANT',
  'WIS',
  'FAM',
];

function isDamageHealChoiceId(value: unknown): value is DamageHealChoiceId {
  return value === 'damage' || value === 'heal';
}

function isDamageHealChargeShipDefId(
  value: string,
): value is DamageHealChargeShipDefId {
  return (DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS as readonly string[]).includes(value);
}

export function getTargetedChoiceEffect(option: any): any | null {
  return option?.effects?.find(
    (effect: any) =>
      effect?.kind === EffectKind.Destroy ||
      effect?.kind === EffectKind.TransferShip,
  ) ?? null;
}

export function shouldApplyOpponentSacProtectionForTargetedEffect(
  effect: any,
): boolean {
  return effect?.kind !== EffectKind.TransferShip;
}

export function getRequiredTargetCountForTargetedEffect(effect: any): number {
  const rawRequiredTargetCount =
    typeof effect?.requiredTargetCount === 'number'
      ? effect.requiredTargetCount
      : effect?.count;

  if (
    Number.isInteger(rawRequiredTargetCount) &&
    rawRequiredTargetCount > 0
  ) {
    return rawRequiredTargetCount;
  }

  return 1;
}

export function isStructuredChoicePowerAvailableForShip(
  state: any,
  ship: any,
  actionId: string,
  power: any,
): boolean {
  if (power?.onceOnly === 'on_build_turn') {
    const currentTurnNumber: number = state?.gameData?.turnNumber ?? 1;
    if (ship?.createdTurn !== currentTurnNumber) {
      return false;
    }
  }

  if (power?.onceOnly) {
    const onceOnlyFired = state?.gameData?.powerMemory?.onceOnlyFired ?? {};
    if (onceOnlyFired[`${ship.instanceId}::${actionId}`] === true) {
      return false;
    }
  }

  const actionRequiresCharge =
    (power?.requiresCharge ?? false) ||
    (Array.isArray(power?.options) &&
      power.options.some((option: any) =>
        (option?.requiresCharge ?? false) === true
      ));

  if (!actionRequiresCharge) {
    return true;
  }

  const turnNumber: number = state?.gameData?.turnNumber ?? 1;
  const usedMap: Record<string, number> =
    state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};

  return usedMap[ship.instanceId] !== turnNumber;
}

export function hasEnoughChargeForChoice(
  ship: any,
  power: any,
  choiceId: string,
): boolean {
  const option = power?.options?.find((candidate: any) =>
    candidate?.choiceId === choiceId
  );
  if (!option) {
    return false;
  }

  const requiresCharge =
    (option?.requiresCharge ?? false) || (power?.requiresCharge ?? false);
  if (!requiresCharge) {
    return true;
  }

  const chargeCost = option?.chargeCost ?? power?.chargeCost ?? 1;
  return Number(ship?.chargesCurrent ?? 0) >= chargeCost;
}

export function getStructuredChoicePowerForShipDef(args: {
  shipDefId: string;
  phaseKey: string;
  choiceIds?: string[];
  targetedEffectKind?: EffectKind.Destroy | EffectKind.TransferShip;
}):
  | {
      actionId: string;
      choiceId: string;
      power: any;
      option: any;
      targetedEffect: any | null;
    }
  | null {
  const { shipDefId, phaseKey, choiceIds, targetedEffectKind } = args;
  const shipDef = getShipDefinition(shipDefId);
  const structuredPowers = shipDef?.structuredPowers;
  if (!Array.isArray(structuredPowers)) {
    return null;
  }

  for (let powerIndex = 0; powerIndex < structuredPowers.length; powerIndex += 1) {
    const power = structuredPowers[powerIndex];
    if (power?.type !== 'choice') {
      continue;
    }

    if (
      !Array.isArray(power?.options) ||
      !(power.timings as readonly string[] | undefined)?.includes(phaseKey)
    ) {
      continue;
    }

    const option = power.options.find((candidate: any) => {
      const choiceId = candidate?.choiceId;
      if (typeof choiceId !== 'string' || choiceId.length === 0) {
        return false;
      }
      if (Array.isArray(choiceIds) && !choiceIds.includes(choiceId)) {
        return false;
      }
      const targetedEffect = getTargetedChoiceEffect(candidate);
      if (targetedEffectKind && targetedEffect?.kind !== targetedEffectKind) {
        return false;
      }
      return true;
    });
    const choiceId = option?.choiceId;
    const targetedEffect = getTargetedChoiceEffect(option);

    if (typeof choiceId !== 'string' || choiceId.length === 0) {
      continue;
    }

    return {
      actionId: `${shipDefId}#${powerIndex}`,
      choiceId,
      power,
      option,
      targetedEffect,
    };
  }

  return null;
}

function getSnappedChargeSourceIds(state: any, playerId: string): string[] {
  const rawSourceIds = state?.gameData?.turnData
    ?.chargeDeclarationEligibleSourceIdsByPlayerId?.[playerId];
  if (!Array.isArray(rawSourceIds)) {
    return [];
  }

  const sourceIds: string[] = [];
  const seen = new Set<string>();
  for (const sourceId of rawSourceIds) {
    if (
      typeof sourceId !== 'string' || sourceId.length === 0 ||
      seen.has(sourceId)
    ) {
      continue;
    }
    seen.add(sourceId);
    sourceIds.push(sourceId);
  }
  return sourceIds;
}

function resolveSnappedChargeSource(
  state: any,
  playerId: string,
  sourceInstanceId: string,
): any | null {
  const liveFleet = state?.gameData?.ships?.[playerId] ?? [];
  if (Array.isArray(liveFleet)) {
    const liveShip = liveFleet.find((ship: any) =>
      ship?.instanceId === sourceInstanceId
    );
    if (liveShip) {
      return liveShip;
    }
  }

  const voidFleet = state?.gameData?.voidShipsByPlayerId?.[playerId] ?? [];
  if (Array.isArray(voidFleet)) {
    return voidFleet.find((ship: any) =>
      ship?.instanceId === sourceInstanceId
    ) ?? null;
  }

  return null;
}

export function getChargeSourceShipsForPhase(
  state: any,
  playerId: string,
): any[] {
  const sourceShips: any[] = [];
  for (const sourceInstanceId of getSnappedChargeSourceIds(state, playerId)) {
    const ship = resolveSnappedChargeSource(state, playerId, sourceInstanceId);
    if (ship) {
      sourceShips.push(ship);
    }
  }
  return sourceShips;
}

function getLegalDamageHealChoiceIdsForShip(
  ship: any,
  power: any,
): DamageHealChoiceId[] {
  if (!power) {
    return [];
  }

  const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
  const legalChoiceIds: DamageHealChoiceId[] = [];
  for (const option of power.options) {
    const choiceId = option?.choiceId;
    if (!isDamageHealChoiceId(choiceId)) {
      continue;
    }
    const requiresCharge =
      (option?.requiresCharge ?? false) || (power.requiresCharge ?? false);
    if (!requiresCharge) {
      legalChoiceIds.push(choiceId);
      continue;
    }
    const chargeCost = option?.chargeCost ?? power.chargeCost ?? 1;
    if (chargesCurrent >= chargeCost) {
      legalChoiceIds.push(choiceId);
    }
  }
  return legalChoiceIds;
}

function chooseDamageHealChoiceId(args: {
  state: any;
  playerId: string;
  policy: DamageHealChargePolicy;
  legalChoiceIds: DamageHealChoiceId[];
}): DamageHealChoiceId | null {
  const { state, playerId, policy, legalChoiceIds } = args;
  if (legalChoiceIds.length === 0) {
    return null;
  }

  const player = (state?.players ?? []).find((entry: any) =>
    entry?.id === playerId
  );
  const opponent = (state?.players ?? []).find((entry: any) =>
    entry?.role === 'player' && entry?.id !== playerId
  );
  const playerHealth = Number(player?.health ?? 0);
  const opponentHealth = Number(opponent?.health ?? 0);
  const legalChoiceIdSet = new Set<DamageHealChoiceId>(legalChoiceIds);

  if (
    typeof policy.healSelfAtOrBelow === 'number' &&
    playerHealth <= policy.healSelfAtOrBelow &&
    legalChoiceIdSet.has('heal')
  ) {
    return 'heal';
  }
  if (
    typeof policy.damageOpponentAtOrBelow === 'number' &&
    opponentHealth <= policy.damageOpponentAtOrBelow &&
    legalChoiceIdSet.has('damage')
  ) {
    return 'damage';
  }
  if (legalChoiceIdSet.has('damage')) return 'damage';
  if (legalChoiceIdSet.has('heal')) return 'heal';
  return null;
}

export function planDamageHealChargeActions(args: {
  state: any;
  playerId: string;
  chargePolicy?: DamageHealChargePolicyMap;
}): PowerActionPayload[] {
  const { state, playerId, chargePolicy } = args;
  const chargeShips = getChargeSourceShipsForPhase(state, playerId)
    .filter((ship: any) =>
      typeof ship?.shipDefId === 'string' &&
      isDamageHealChargeShipDefId(ship.shipDefId) &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0
    )
    .sort((left: any, right: any) => {
      const leftOrder = DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS.indexOf(
        left.shipDefId,
      );
      const rightOrder = DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS.indexOf(
        right.shipDefId,
      );
      return leftOrder - rightOrder ||
        left.instanceId.localeCompare(right.instanceId);
    });

  const actions: PowerActionPayload[] = [];
  for (const ship of chargeShips) {
    const shipDefId = ship.shipDefId as DamageHealChargeShipDefId;
    const choicePower = getStructuredChoicePowerForShipDef({
      shipDefId,
      phaseKey: 'battle.charge_declaration',
      choiceIds: ['damage', 'heal'],
    });
    if (
      !choicePower ||
      !isStructuredChoicePowerAvailableForShip(
        state,
        ship,
        choicePower.actionId,
        choicePower.power,
      )
    ) {
      continue;
    }

    const policy = chargePolicy?.[shipDefId] ??
      DEFAULT_MISSING_DAMAGE_HEAL_CHARGE_POLICY;
    const choiceId = chooseDamageHealChoiceId({
      state,
      playerId,
      policy,
      legalChoiceIds: getLegalDamageHealChoiceIdsForShip(
        ship,
        choicePower.power,
      ),
    });
    if (!choiceId) {
      continue;
    }
    actions.push({
      actionType: 'power',
      actionId: choicePower.actionId,
      sourceInstanceId: ship.instanceId,
      choiceId,
    });
  }

  return actions;
}
