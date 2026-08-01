import { isShipDefId } from '../../data/ShipDefinitions.core';
import { calculateAncientSiphonEffect } from '../../data/ancientSiphonRules';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import type { FixedAncientManualSolarPowerId } from './ancientChargeDeclaration';

export type AncientSolarHoverValue = {
  label?: string;
  healing?: number;
  damage?: number;
};

export function deriveAncientSolarHoverValues(args: {
  effectiveDiceValue: number;
  chargeScopedFleet: readonly any[];
  canCastManualSolarPowerById: Readonly<
    Record<FixedAncientManualSolarPowerId, boolean>
  >;
  siphonSelector: {
    maxSpend: number;
    canOpen: boolean;
  };
  canCastBlackHole: boolean;
  blackHoleDamagePreview: number;
}): Partial<Record<ShipDefId, AncientSolarHoverValue>> {
  const values: Partial<Record<ShipDefId, AncientSolarHoverValue>> = {};
  const canCast = args.canCastManualSolarPowerById;

  if (canCast.SLIF) {
    values.SLIF = { healing: 1 };
  }
  if (canCast.SAST) {
    values.SAST = { damage: 1 };
  }
  if (canCast.SSTA) {
    values.SSTA = { healing: args.effectiveDiceValue + 3 };
  }
  if (canCast.SSUP) {
    values.SSUP = { damage: args.effectiveDiceValue + 3 };
  }
  if (canCast.SVOR) {
    const distinctShipDefIds = new Set<ShipDefId>();
    for (const ship of args.chargeScopedFleet) {
      const shipDefId = ship?.shipDefId;
      if (isShipDefId(shipDefId)) {
        distinctShipDefIds.add(shipDefId);
      }
    }
    values.SVOR = { damage: distinctShipDefIds.size * 2 };
  }

  if (args.siphonSelector.canOpen) {
    const effect = calculateAncientSiphonEffect(args.siphonSelector.maxSpend);
    if (effect !== null) {
      values.SSIP = {
        label: 'Max red & green:',
        healing: effect,
        damage: effect,
      };
    }
  }

  if (args.canCastBlackHole) {
    values.SBLA = { damage: args.blackHoleDamagePreview };
  }

  return values;
}
